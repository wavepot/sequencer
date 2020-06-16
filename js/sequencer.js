import State from './state.js'
import Grid from './grid.js'
import Mouse from './mouse.js'
import Editor from './editor.js'
import { Primrose } from '../Primrose/js/package/index.js'

export default el => {
  const app = {}

  if (window.DEBUG) window.app = app

  const editors = app.editors = new Map
  const state = app.state = State()
  const grid = app.grid = new Grid(app, function (square, id, value) {
    if (id) {
      let instance = editors.get(id)
      if (!instance) {
        const editor = new Editor(this, square, localStorage.getItem(id))
        editor.id = id
        editor.instance.id = id
        editor.instance.addEventListener('change', () => {
          localStorage.setItem(editor.id, editor.instance.value)
        })
        Primrose.add(app, editor.instance)
        editors.set(id, editor.instance)
        return editor
      } else {
        return new Editor(this, square, instance)
      }
    } else {
      const editor = new Editor(
        this,
        square,
        // drawing with shift key pressed makes a clone, otherwise a mirror
        state.keys.Shift
          ? state.brush?.instance.value
          : state.brush?.instance
      )
      if (!editors.has(editor.id)) {
        editor.instance.addEventListener('change', () => {
          localStorage.setItem(editor.id, editor.instance.value)
        })
        Primrose.add(app, editor.instance)
        editors.set(editor.id, editor.instance)
      }
      return editor
    }
  })
  const mouse = app.mouse = Mouse(app)

  const fixEvent = e => {
    if (state.focus && 'offsetX' in e) {
      e.realOffsetX = (e.offsetX - state.focus.offset.x) * state.focus.scale
      e.realOffsetY = (e.offsetY - state.focus.offset.y) * state.focus.scale
    }
    return e
  }

  const handleMouseWheel = (e, noUpdate = false) => {
    if (state.focus && !state.keys.Control) return
    e.preventDefault()

    if (!state.zoomStart) state.zoomStart = Date.now()

    clearTimeout(state.zoomTimeout)
    state.zoomTimeout = setTimeout(() => { state.zoomStart = null }, 300)

    if (!noUpdate) {
      mouse.update(mouse.parseEvent(e))
    }

    grid.setScale(grid.scale - (
      noUpdate
        ? mouse.prev.d - mouse.px.d
        : mouse.px.d
    ))

    grid.setShift({
      x: Math.max(
        -mouse.square.x,
        mouse.px.x / grid.zoom - (
          mouse.pos.x - (mouse.pos.x - (mouse.square.x + .75)) *.12)
        ),
      y: Math.max(
        -mouse.square.y,
        mouse.px.y / grid.zoom - (
          mouse.pos.y - (mouse.pos.y - (mouse.square.y + .75)) *.12))
    })

    if (noUpdate) return

    grid.render()
  }

  const handleMouseMove = e => {
    if (mouse.down) {
      const { x, y, d } = mouse.parseEvent(e)

      clearTimeout(state.drawingTimeout)

      // if we are drawing, maybe draw a square
      if (state.drawing) {
        e.preventDefault()

        mouse.update({ x, y, d })
        if (!grid.hasSquare(mouse.square)) {
          state.brush = grid.addSquare(mouse.square)
        }
        return
      }

      // when an editor is focused, delegate event to it
      if (state.focus === grid.getSquare(mouse.square)) {
        return state.focus.instance.readMouseMoveEvent(fixEvent(e))
      }

      // if we have a distance, then this is a pinch zoom
      // TODO: overloading mousewheel event is hacky
      if (d) {
        e.preventDefault()
        mouse.update({ d })
        handleMouseWheel(e, true)
      } else {
        // not enough pixels distance to drag yet
        if (state.dragTimer && Math.abs(x - mouse.px.x) < 6 && Math.abs(y - mouse.px.y) < 6) return
      }

      // we are dragging
      state.dragTimer = 0

      const dx = mouse.px.x - x
      const dy = mouse.px.y - y
      // if diffs are too large then it's probably a pinch error, so discard
      if (Math.abs(dx) < 150 && Math.abs(dy) < 150) {
        state.didMove = true
        grid.setShift({
          x: grid.shift.x - (mouse.px.x - x) / grid.zoom,
          y: grid.shift.y - (mouse.px.y - y) / grid.zoom
        })
      }

      mouse.update({ x, y, d })

      grid.render()
    }
  }

  const handleMouseDown = e => {
    mouse.update(mouse.parseEvent(e))
    mouse.down = true

    state.dragTimer = performance.now()

    if (mouse.which === 1) {
      // mouse down on active square
      if (grid.hasSquare(mouse.square)) {
        // mouse down on focused squard, delegate event to it
        if (state.focus === grid.getSquare(mouse.square)) {
          return state.focus.instance.readMouseDownEvent(fixEvent(e))
        }
        // TODO: do something?
      } else {
        // start drawing on long press
        state.drawingTimeout = setTimeout(() => {
          state.drawing = true
          if (!grid.hasSquare(mouse.square)) {
            state.brush = grid.addSquare(mouse.square)
          }
        }, 500)
      }
    }
  }

  const handleMouseUp = e => {
    mouse.down = false

    clearTimeout(state.drawingTimeout)
    if (state.drawing) {
      state.drawing = false
      e.preventDefault()
      return
    }

    if (mouse.which === 1) { // left click

      if (performance.now() - state.dragTimer < 200 || state.focus) {
        if (grid.hasSquare(mouse.square)) {
          const square = grid.getSquare(mouse.square)
          state.brush = square
          if (state.focus === square) {
            state.focus.instance.readMouseUpEvent(fixEvent(e))
          } else if (!state.didMove) {
            if (state.focus) {
              state.focus.blur()
            }
            state.focus = state.brush = square
            state.focus.focus()
            state.focus.instance.readMouseDownEvent(fixEvent(e))
            state.focus.instance.readMouseUpEvent(fixEvent(e))
          }
        } else if (state.focus && !state.didMove) {
          state.focus.blur()
          state.focus = null
        } else if (!state.didMove) {
          state.brush = grid.addSquare(mouse.square)
        }
      }
    } else if (mouse.which === 2) {
      e.preventDefault() // prevent operating system from doing paste on middle click
      const square = grid.getSquare(mouse.square)
      if (state.focus && state.focus !== square) {
        state.focus.blur()
        state.focus = null
      }
      // if there is a square, save it in brush
      // and remove it
      if (square) {
        state.brush = square
        grid.removeSquare(mouse.square)
        if (state.keys.Shift) { // if shift is pressed, replace with clone and focus
          grid.addSquare(mouse.square).focus()
          // TODO: copy also caret/scroll position
        }
      } else {
        // if there isn't a square, clear brush
        state.brush = null
      }
    }

    state.didMove = false
  }

  const handleMouseOver = e => {
    if (state.focus) {
      return state.focus.instance.readMouseOverEvent(fixEvent(e))
    }
  }

  const handleMouseOut = e => {
    if (state.focus) {
      return state.focus.instance.readMouseOverEvent(fixEvent(e))
    }
  }

  const handleKeyDown = e => {
    const { keys } = state
    keys[e.key] = true

    if (keys.Escape) {
      if (state.focus) {
        e.preventDefault()
        state.focus.blur()
        state.focus = null
      }
    }
  }

  const handleKeyUp = e => {
    const { keys } = state
    keys[e.key] = false
  }

  const handleWindowResize = () => {
    grid.resize()
    grid.render()
  }

  window.addEventListener('resize', handleWindowResize, { passive: false })

  window.addEventListener('wheel', handleMouseWheel, { passive: false })
  window.addEventListener('mousedown', handleMouseDown, { passive: false })
  window.addEventListener('mouseup', handleMouseUp, { passive: false })
  window.addEventListener('mouseover', handleMouseOver, { passive: false })
  window.addEventListener('mouseout', handleMouseOut, { passive: false })
  window.addEventListener('mousemove', handleMouseMove, { passive: false })
  window.addEventListener('touchmove', handleMouseMove, { passive: false })
  window.addEventListener('touchstart', handleMouseDown, { passive: false })

  window.addEventListener('keydown', handleKeyDown, { passive: false })
  window.addEventListener('keyup', handleKeyUp, { passive: false })

  grid.load()
  grid.render()
  el.appendChild(grid.canvas)
}

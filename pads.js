import { Primrose } from './Primrose/js/package/index.js'

const calcOffset = v => v >= 0 ? v - Math.floor(v) : 1 - calcOffset(-v)

const debug = window.debug = {}

const colors = {
  back: '#eee',
  grid: '#ccc', //'#222222',
  phrase: '#666',
  square: '#000',
  pointer: '#000',
}

const theme = {
    name: "Darker",
    cursorColor: "white",
    unfocused: "rgba(0,0,0,0)",
    currentRowBackColor: "#202020",
    selectedBackColor: "#404040",
    lineNumbers: {
        foreColor: "white"
    },
    regular: {
        backColor: "black",
        foreColor: "#999"
    },
    strings: {
        foreColor: "#fff",
        // fontStyle: "italic"
    },
    regexes: {
        foreColor: "#fff",
        fontStyle: "italic"
    },
    numbers: {
        foreColor: "#fff"
    },
    comments: {
        foreColor: "#555",
        // fontStyle: "italic"
    },
    keywords: {
        foreColor: "#fff"
    },
    operators: {
        foreColor: "#ccc"
    },
    symbol: {
      foreColor: '#ccc'
    },
    declare: {
        foreColor: "#fff"
    },
    functions: {
        foreColor: "#fff",
        // fontWeight: "bold"
    },
    special: {
        foreColor: "#fff",
        // fontWeight: "bold"
    },
    members: {
        foreColor: "#aaa"// "#6bf"
    },
    error: {
        foreColor: "red",
        fontStyle: "underline italic"
    }
}

export default function yep (el, { onchange } = { onchange: () => {} }) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  context.imageSmoothingEnabled = false

  let timer = 0

  let squares = debug.squares = localStorage.squares ? JSON.parse(localStorage.squares) : {}

  let editors = debug.editors = {}

  let pointers = debug.pointers = []

  const controls = debug.controls = {
    down: false,
    ox: 0, oy: 0, od: 0, // old position
    x: 0, y: 0, d: 0, // absolute position
    rx: 0, ry: 0, // relative position
    nx: 0, ny: 0, // normalized position
    which: 0,
    parseMouseEvent (e) {
      controls.which = e.which
      let x, y, d = 0
      if (e.targetTouches) {
        if (e.targetTouches.length >= 1) {
          x = e.targetTouches[0].pageX
          y = e.targetTouches[0].pageY
        }
        if (e.targetTouches.length >= 2) {
          d = Math.sqrt(
            Math.pow(e.targetTouches[1].pageX - x, 2) +
            Math.pow(e.targetTouches[1].pageY - y, 2)
          ) / 400
        }
      } else {
        x = e.clientX
        y = e.clientY
        d = (e.deltaY || 0) / 1000
      }
      return { x, y, d }
    },
    update ({ x = this.x, y = this.y, d = this.d }) {
      this.ox = this.x
      this.oy = this.y
      this.od = this.d
      this.x = x
      this.y = y
      this.d = d
      this.rx = x / screen.zoom - screen.shift.x
      this.ry = y / screen.zoom - screen.shift.y
      this.nx = Math.floor(this.rx)
      this.ny = Math.floor(this.ry)
    }
  }

  const screen = debug.screen = {
    canvas: { width: 1000, height: 1000 },
    size: { width: 0, height: 0 },
    shift: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    setShift ({ x, y }) {
      this.shift.x = x
      this.shift.y = y
      this.offset.x = calcOffset(this.shift.x)
      this.offset.y = calcOffset(this.shift.y)
      localStorage.shift = JSON.stringify(this.shift)
    },
    zoom: 50,
    maxScreenZoom: 6,
    setZoom (zoom) {
      this.nzoom = localStorage.zoom = Math.max(Math.log(2), Math.min(Math.max(Math.log(this.canvas.height * this.maxScreenZoom), Math.log(this.canvas.width * this.maxScreenZoom)), zoom)) || 50
      // this.nzoom = localStorage.zoom = Math.max(Math.log(2), Math.min(Math.log(this.canvas.height * .93), Math.log(this.canvas.width * .93), zoom)) || 50
      this.zoom = Math.max(2, Math.min(Math.max(this.canvas.height * this.maxScreenZoom, this.canvas.width * this.maxScreenZoom), Math.exp(this.nzoom)))
      // this.zoom = Math.max(2, Math.min(this.canvas.height * .93, this.canvas.width * .93, Math.exp(this.nzoom)))
      if (this.zoom > 22) {
        if (Date.now() - zoomStart < 350) {
          this.zoom = Math.round(this.zoom)
        }
      }
      // console.log(this.zoom)
      this.size.width = this.canvas.width / this.zoom
      this.size.height = this.canvas.height / this.zoom
    }
  }

  const getEditor = (hashPos) => {
    if (screen.zoom < 45) return
    let editor = editors[hashPos]
    if (!editor) {
      let flipSize // = screen.zoom
      const flipThreshold = 1300
      let lastWidth, lastHeight, currWidth, currHeight
      editor = editors[hashPos] = {
        pos: hashPosToXY(hashPos),
        display: new OffscreenCanvas(512,512),
        instance: new Primrose({
          theme,
          wordWrap: false,
          lineNumbers: false,
          fontSize: 16,
          padding: 0,
          width: 512, //flipSize ? 1024+512 : 1024,
          height: 512, //flipSize ? 1024+512 : 1024,
          scaleFactor: 1,
        }),
        drawToSquare() {
          const [x, y] = hashPosToXY(hashPos)
          const maxWidth = screen.canvas.width
          const maxHeight = screen.canvas.height
          let p = editor.scale = 1
          // if (screen.zoom > flipThreshold && flipSize !== screen.zoom) { //} && !flipSize) {
          //   flipSize = screen.zoom

          //   newX = 512 + Math.min(screen.canvas.width+flipThreshold+1000, (screen.zoom-flipThreshold)*1.6)
          //   newY = 512 + Math.min(screen.canvas.width+flipThreshold+1000, (screen.zoom-flipThreshold)*1.6)
          //   // p = newX / newY
          //   // console.log(p)
          //   editor.instance.setSize(newX, newY)
          // } else if (screen.zoom <= flipThreshold && flipSize) {
          //   flipSize = false
          //   editor.instance.setSize(512, 512)
          // }
          let width, height
          width = height = screen.zoom

          if (screen.zoom > maxWidth && screen.zoom > maxHeight) {
            if (screen.zoom > maxWidth) {
              if (screen.zoom - maxWidth > flipThreshold) {
                p = maxWidth / (screen.zoom - flipThreshold)
              }
            } else {
              if (screen.zoom - maxHeight > flipThreshold) {
                p = maxHeight / (screen.zoom - flipThreshold)
              }
            }
            editor.scale = p
            currWidth = Math.min(width, maxWidth) * p
            currHeight = Math.min(height, maxHeight) * p
            if (currWidth !== lastWidth || currHeight !== lastHeight) {
              editor.instance.setSize(currWidth, currHeight)
              lastWidth = currWidth
              lastHeight = currHeight
            }
            width = Math.min(width, maxWidth)
            height = Math.min(height, maxHeight)
          } else {
            currWidth = width = Math.min(maxWidth, screen.zoom)
            currHeight = height = Math.min(maxHeight, screen.zoom)
            if (currWidth !== lastWidth || currHeight !== lastHeight) {
              editor.instance.setSize(currWidth, currHeight)
              lastWidth = currWidth
              lastHeight = currHeight
            }
          }

          // editor.display.width = screen.zoom
          // editor.display.height = screen.zoom
          // editor.display.getContext('2d')
          editor.offsetX = Math.floor(x * screen.zoom + screen.shift.x * screen.zoom)
          editor.offsetY = Math.floor(y * screen.zoom + screen.shift.y * screen.zoom)
          context.imageSmoothingEnabled = false
          context.drawImage(
            editor.instance.canvas,
            // 0,0
            editor.offsetX, //Math.floor(x * screen.zoom + screen.shift.x * screen.zoom),
            editor.offsetY, //Math.floor(y * screen.zoom + screen.shift.y * screen.zoom),
            // Math.min(width, maxWidth),
            // Math.min(height, maxHeight)
            width, height
            // Math.floor(screen.zoom),
            // Math.floor(screen.zoom)
          )
          // context.drawImage(
          //   editor.display,
          //   Math.floor(x * screen.zoom + screen.shift.x * screen.zoom),
          //   Math.floor(y * screen.zoom + screen.shift.y * screen.zoom),
          // )
        }
      }
      editor.instance.theme = theme
      editor.instance.addEventListener('change', editor.drawToSquare);
      editor.instance.addEventListener('update', editor.drawToSquare);
      editor.instance.value = [
        getEditor,
        resize,
        drawSquares,
        drawGrid,
        isVisibleSquare,
      ][Math.random() * 0 | 0].toString()
      // setTimeout(() => {
        editor.drawToSquare()
      // }, 100)
    }
    return editor
  }

  function resize() {
    screen.canvas.width = canvas.width = document.documentElement.clientWidth
    screen.canvas.height = canvas.height = document.documentElement.clientHeight
  }

  function clear () {
    context.fillStyle = colors.back
    context.fillRect(0, 0, screen.canvas.width, screen.canvas.height)
  }

  const drawHorizontalLine = x => {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, screen.canvas.height)
    context.stroke()
  }

  const drawVerticalLine = y => {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(screen.canvas.width, y)
    context.stroke()
  }

  const hashPosToXY = hashPos => hashPos.split(',')

  const drawSquare = (hashPos) => {
    const [x, y] = hashPosToXY(hashPos)

let cs = [
  // '#44f',
  // '#f00',
  '#000',
  // '#f10',
  // '#333',
  // '#688',
]
    context.fillStyle = cs[y % cs.length]
      // + (Math.random() * 16 | 0).toString(16) //colors.square
      // + (Math.random() * 16 | 0).toString(16) //colors.square
      // + (Math.random() * 16 | 0).toString(16) //colors.square
    context.fillRect(
      Math.floor(x * screen.zoom + screen.shift.x * screen.zoom) - 1,
      Math.floor(y * screen.zoom + screen.shift.y * screen.zoom) - 1,
      screen.zoom + 1,
      screen.zoom + 1
    )

    getEditor(hashPos)?.drawToSquare()
    // context.drawImage(
    //   editor.canvas,
    //   Math.floor(x * screen.zoom + screen.shift.x * screen.zoom) - 1,
    //   Math.floor(y * screen.zoom + screen.shift.y * screen.zoom) - 1,
    //   screen.zoom + 1,
    //   screen.zoom + 1
    // )
    // if (screen.zoom > 100) {

    // }
  }

  const drawPointer = (hashPos) => {
    const [x, y] = hashPosToXY(hashPos)

    context.fillStyle = colors.pointer
    context.fillRect(
      Math.floor(x * screen.zoom + screen.shift.x * screen.zoom) - 1,
      Math.floor(y * screen.zoom + screen.shift.y * screen.zoom) - 1,
      screen.zoom + 1,
      screen.zoom + 1
    )

    getEditor(hashPos)?.drawToSquare()
    // if (screen.zoom > 100) {
    // }

    // context.drawImage(
    //   editor.canvas,
    //   Math.floor(x * screen.zoom + screen.shift.x * screen.zoom) - 1,
    //   Math.floor(y * screen.zoom + screen.shift.y * screen.zoom) - 1,
    //   screen.zoom + 1,
    //   screen.zoom + 1
    // )
  // setTimeout(() => {
  // editor.focus()

  //   editor.resize()
  // },1000)
    // editor.setSize(screen.zoom, screen.zoom)
    // editor.scaleFactor = 1
  }

  const isVisibleSquare = (hashPos) => {
    const [x, y] = hashPosToXY(hashPos)
    return (
      x >= Math.floor(-screen.shift.x) &&
      y >= Math.floor(-screen.shift.y) &&
      x <= Math.ceil(-screen.shift.x + screen.size.width) &&
      y <= Math.ceil(-screen.shift.y + screen.size.height)
    )
  }

  const isAudibleSquare = (hashPos) => {
    const [x, y] = hashPosToXY(hashPos)
    return (
      x > Math.floor(-screen.shift.x) &&
      y > Math.floor(-screen.shift.y) &&
      x < Math.floor(-screen.shift.x + screen.size.width) &&
      y < Math.floor(-screen.shift.y + screen.size.height)
    )
  }

  const drawSquares = () => {
    requestAnimationFrame(() => {

    const visible = Object.keys(squares).filter(isVisibleSquare)
      // .concat(Object.keys(squares).filter(isAudibleSquare))
    visible.forEach(drawSquare)
    // const audible = Object.keys(squares).filter(isAudibleSquare)
    // audible.forEach(drawPointer)
    onchange({ visible }) //, audible })
    })
  }

  const posToHash = pos => `${pos.x},${pos.y}`

  const toggleSquare = pos => {
    const hashPos = posToHash(pos)

    if (hashPos in squares) {
      delete squares[hashPos]
      delete editors[hashPos]
      // clearSquare(hash)
      // clear()
      render()
    } else {
      squares[hashPos] = true
      drawSquare(hashPos)
    }

    localStorage.squares = JSON.stringify(squares)
  }

  function drawGrid () {
    context.save()

    context.lineWidth = Math.min(1, .02 + screen.zoom / 55)

    for (let x = 0; x < screen.size.width; x++) {
    context.strokeStyle = (-1+x-Math.ceil(screen.shift.x)) % 4 === 0? colors.phrase : colors.grid
      drawHorizontalLine(Math.floor(x * screen.zoom + screen.offset.x * screen.zoom) - .5)
    }

    for (let y = 0; y < screen.size.height; y++) {
    // context.strokeStyle = colors.grid
    context.strokeStyle = (y-Math.floor(screen.shift.y)) % 4 === 0? colors.phrase : colors.grid
      drawVerticalLine(Math.floor(y * screen.zoom + screen.offset.y * screen.zoom) - .5)
    }

    context.restore()
  }

  function createPointer () {
    const pointer = {
      x: 0,
      y: 0,
      vel: { x: 1, y: 0 },
      area: {},
      visited: {},
      inArea: pos => posToHash(pos) in this.area,
      hasVisited: pos => posToHash(pos) in this.visited,
      advance () {
        if (Object.keys(area).length === 0) return
        if (Object.keys(area).length === Object.keys(visited).length) {
          visited = {}
        }

        let next
        next = { x: this.x + this.vel.x, y: this.y + this.vel.y }
        if (this.attempt(pos)) return
        this.vel.y =
        next = { x: this.x + this.vel.x, y: this.y + this.vel.y }
        if (this.attempt(pos)) return
      },
      attempt (pos) {
        if (this.hasVisited(pos)) return false
        this.x = pos.x
        this.y = pos.y
        return true
      }
    }

    pointers.push(pointer)
  }

  function render () {
    clear()
      drawGrid()
    // requestAnimationFrame(() => {
    drawSquares()
    // })
  }

  let zoomStart
  let zoomTimeout

  function handleZoom (e, noUpdate = false) {
    if (focus && !keys.Control) return
    e.preventDefault()
    if (!zoomStart) zoomStart = Date.now()
    clearTimeout(zoomTimeout)
    zoomTimeout = setTimeout(() => { zoomStart = null }, 300)
    if (!noUpdate) controls.update(controls.parseMouseEvent(e))
    // TODO: replace 'nzoom'
    screen.setZoom(screen.nzoom - (noUpdate ? controls.od - controls.d : controls.d))
    // TODO: this should be a normalized method
    screen.setShift({
      x: Math.max(-controls.nx, controls.x / screen.zoom - (controls.rx - (controls.rx - (controls.nx + .75)) *.12)),
      y: Math.max(-controls.ny, controls.y / screen.zoom - (controls.ry - (controls.ry - (controls.ny + .75)) *.12))
    })
    if (noUpdate) return
    // clear()
    render()
  }

  window.addEventListener('resize', () => {
    resize()
    screen.setZoom(screen.nzoom)
    render()
  })

  const fixEvent = (e, focus) => {
    if ('offsetX' in e) {
      e.realOffsetX = (e.offsetX - focus.offsetX) * focus.scale
      e.realOffsetY = (e.offsetY - focus.offsetY) * focus.scale
    }
    return e
  }

  let didMove = false

  function handleMove (e) {
    const hashPos = posToHash({ x: controls.nx, y: controls.ny })

    if (focus === editors[hashPos]) return focus.instance.readMouseMoveEvent(fixEvent(e, focus))

    e.preventDefault()
    if (controls.down) {
      const { x, y, d } = controls.parseMouseEvent(e)
      if (d) {
        controls.update({ d })
        handleZoom(e, true)
      } else {
        if (timer && Math.abs(x - controls.x) < 6 && Math.abs(y - controls.y) < 6) return
      }
      timer = 0
      const dx = controls.x - x
      const dy = controls.y - y
      // if diffs are too large then it's probably a pinch error, so discard
      if (Math.abs(dx) < 150 && Math.abs(dy) < 150) {
        didMove = true
        screen.setShift({
          x: screen.shift.x - (controls.x - x) / screen.zoom,
          y: screen.shift.y - (controls.y - y) / screen.zoom
        })
      }
      controls.update({ x, y, d })
      // clear()
      render()
    }
  }

  function handleKeyDown (e) {
    // e.preventDefault()
    keys[e.key] = true
    if (keys.Escape) {
      if (focus) focus.instance.blur()
      focus = false
    }
    if (focus && keys.Meta && keys.Shift && keys.ArrowLeft) {
      focus.instance.blur()
      let [x, y] = focus.pos
      x -= 1
      focus = getEditor(posToHash({ x, y }))
      focus.instance.focus()
    }
    if (focus && keys.Meta && keys.Shift && keys.ArrowUp) {
      focus.instance.blur()
      let [x, y] = focus.pos
      y -= 1
      focus = getEditor(posToHash({ x, y }))
      focus.instance.focus()
    }
    if (focus && keys.Meta && keys.Shift && keys.ArrowRight) {
      focus.instance.blur()
      let [x, y] = focus.pos
      x += 1
      focus = getEditor(posToHash({ x, y }))
      focus.instance.focus()
    }
    if (focus && keys.Meta && keys.Shift && keys.ArrowDown) {
      focus.instance.blur()
      let [x, y] = focus.pos
      y += 1
      focus = getEditor(posToHash({ x, y }))
      focus.instance.focus()
    }
  }

  function handleKeyUp (e) {
    keys[e.key] = false
  }

  let focus = false
  function handleMouseDown (e) {
    console.log('mousedown', e.which)
    controls.update(controls.parseMouseEvent(e))
    controls.down = true
    timer = performance.now()
    const hashPos = posToHash({ x: controls.nx, y: controls.ny })

    if (controls.which !== 2) {
      if (hashPos in editors) {
        if (editors[hashPos] === focus) return focus.instance.readMouseDownEvent(fixEvent(e, focus))
      }
    }
    // }
  }

  function handleMouseUp (e) {
    console.log('mouseup', e.which)
    controls.down = false

    // if (focus) return focus.instance.readMouseUpEvent(fixEvent(e, focus))
    const hashPos = posToHash({ x: controls.nx, y: controls.ny })
    if (controls.which === 1) { // left click
      if (performance.now() - timer < 200 || focus) {
        if (hashPos in editors) {
          if (focus === editors[hashPos]) {
            focus.instance.readMouseUpEvent(fixEvent(e, focus))
          } else if (!didMove) {
            focus = getEditor(hashPos)
            focus.instance.focus()
            focus.instance.readMouseDownEvent(fixEvent(e, focus))
            focus.instance.readMouseUpEvent(fixEvent(e, focus))
          }
        } else if (focus && !didMove) {
          focus.instance.blur()
          focus = false
        }
      }
    } else if (controls.which === 2) {
            e.preventDefault()

      // if (performance.now() - timer < 200) {
        if (focus && focus !== editors[hashPos]) {
          focus.instance.blur()
          focus = false
        }
        toggleSquare({ x: controls.nx, y: controls.ny })
      // }
    }

    didMove = false
  }

  function handleMouseOver (e) {
    if (focus) return focus.instance.readMouseOverEvent(fixEvent(e, focus))
    //
  }

  function handleMouseOut (e) {
    if (focus) return focus.instance.readMouseOutEvent(fixEvent(e, focus))
    //
  }

        // this.readMouseOverEvent = debugEvt("mouseover", pointerOver);
        // this.readMouseOutEvent = debugEvt("mouseout", pointerOut);
        // this.readMouseDownEvent = debugEvt("mousedown", mouseLikePointerDown(setMousePointer));
        // this.readMouseUpEvent = debugEvt("mouseup", mouseLikePointerUp);
        // this.readMouseMoveEvent
  const keys = {}

  window.addEventListener('wheel', handleZoom, { passive: false })
  window.addEventListener('mouseover', handleMouseOver, { passive: false })
  window.addEventListener('mouseout', handleMouseOut, { passive: false })
  window.addEventListener('mousedown', handleMouseDown, { passive: false })
  window.addEventListener('mouseup', handleMouseUp, { passive: false })
  window.addEventListener('touchstart', handleMouseDown, { passive: false })
  window.addEventListener('mousemove', handleMove, { passive: false })
  window.addEventListener('touchmove', handleMove, { passive: false })
  window.addEventListener('keydown', handleKeyDown, { passive: false })
  window.addEventListener('keyup', handleKeyUp, { passive: false })

  resize()
  screen.setShift(localStorage.shift ? JSON.parse(localStorage.shift) : { x: 0, y: 0 })
  screen.setZoom(localStorage.zoom || 50)
  render()
  el.appendChild(canvas)
  return { squares }
}

// begin.onmousedown = function toggleFullScreen(e) {
//   e.stopPropagation()
//   e.preventDefault()
//   begin.parentNode.removeChild(begin)
//   if (!document.fullscreenElement) {
//     document.documentElement.requestFullscreen()
//   }
//   return false
// }

import { Basic, Dark, Grammar, HTML, JavaScript, Light, PlainText, Primrose, grammars, themes } from './primrose.js'

const calcOffset = v => v >= 0 ? v - (v | 0) : 1 - calcOffset(-v)

const debug = window.debug = {}

const colors = {
  grid: '#000', //'#222222',
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
        foreColor: "#ccc"
    },
    strings: {
        foreColor: "#aa9900",
        fontStyle: "italic"
    },
    regexes: {
        foreColor: "#aa0099",
        fontStyle: "italic"
    },
    numbers: {
        foreColor: "#5cf"
    },
    comments: {
        foreColor: "#555",
        // fontStyle: "italic"
    },
    keywords: {
        foreColor: "#f33"
    },
    functions: {
        foreColor: "#fff",
        // fontWeight: "bold"
    },
    members: {
        foreColor: "#999"
    },
    error: {
        foreColor: "red",
        fontStyle: "underline italic"
    }
}

export default function (el, { onchange } = { onchange: () => {} }) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { alpha: false })

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
    parseEvent (e) {
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
      this.offset.x = calcOffset(x)
      this.offset.y = calcOffset(y)
      localStorage.shift = JSON.stringify(this.shift)
    },
    zoom: 50,
    setZoom (zoom) {
      this.nzoom = localStorage.zoom = Math.max(Math.log(2), Math.min(Math.log(this.canvas.height * .93), Math.log(this.canvas.width * .93), zoom)) || 50
      this.zoom = Math.max(2, Math.min(this.canvas.height * .93, this.canvas.width * .93, Math.exp(this.nzoom)))
      if (this.zoom > 22) {
        if (Date.now() - zoomStart < 350) {
          this.zoom = Math.round(this.zoom)
        }
      }
      console.log(this.zoom)
      this.size.width = this.canvas.width / this.zoom
      this.size.height = this.canvas.height / this.zoom
    }
  }

  const getEditor = (hashPos) => {
    let editor = editors[hashPos]
    if (!editor) {
      editor = editors[hashPos] = {
        instance: new Primrose({
          theme,
          lineNumbers: false,
          fontSize: 16,
          width: 1024,
          height: 1024,
          scaleFactor: 1,
        }),
        drawToSquare() {
          const [x, y] = hashPosToXY(hashPos)
          context.drawImage(
            editor.instance.canvas,
            10 + Math.floor(x * screen.zoom + screen.shift.x * screen.zoom) - 1,
            10 + Math.floor(y * screen.zoom + screen.shift.y * screen.zoom) - 1,
            -20 + screen.zoom + 1,
            -20 + screen.zoom + 1
          )
        }
      }
      editor.instance.theme = theme
      editor.instance.addEventListener("change", editor.drawToSquare);
      editor.instance.value = drawSquare.toString()
      setTimeout(() => {
        editor.drawToSquare()
      }, 100)
    }
    return editor
  }

  function resize() {
    screen.canvas.width = canvas.width = document.documentElement.clientWidth
    screen.canvas.height = canvas.height = document.documentElement.clientHeight
  }

  function clear () {
    context.fillStyle = '#fff'
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

    context.fillStyle = colors.square
    context.fillRect(
      Math.floor(x * screen.zoom + screen.shift.x * screen.zoom) - 1,
      Math.floor(y * screen.zoom + screen.shift.y * screen.zoom) - 1,
      screen.zoom + 1,
      screen.zoom + 1
    )
    // context.drawImage(
    //   editor.canvas,
    //   Math.floor(x * screen.zoom + screen.shift.x * screen.zoom) - 1,
    //   Math.floor(y * screen.zoom + screen.shift.y * screen.zoom) - 1,
    //   screen.zoom + 1,
    //   screen.zoom + 1
    // )
    if (screen.zoom > 100) {
      getEditor(hashPos).drawToSquare()
    }
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
    if (screen.zoom > 100) {
      getEditor(hashPos).drawToSquare()
    }

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
    const visible = Object.keys(squares).filter(isVisibleSquare)
    visible.forEach(drawSquare)
    const audible = Object.keys(squares).filter(isAudibleSquare)
    audible.forEach(drawPointer)
    onchange({ visible, audible })
  }

  const posToHash = pos => `${pos.x},${pos.y}`

  const toggleSquare = pos => {
    const hashPos = posToHash(pos)

    if (hashPos in squares) {
      delete squares[hashPos]
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

    context.strokeStyle = colors.grid
    context.lineWidth = Math.min(1, .02 + screen.zoom / 55)

    for (let x = 0; x < screen.size.width; x++) {
      drawHorizontalLine(Math.floor(x * screen.zoom + screen.offset.x * screen.zoom) - .5)
    }

    for (let y = 0; y < screen.size.height; y++) {
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
    drawSquares()
  }

  let zoomStart
  let zoomTimeout

  function handleZoom (e, noUpdate = false) {
    e.preventDefault()
    if (!zoomStart) zoomStart = Date.now()
    clearTimeout(zoomTimeout)
    zoomTimeout = setTimeout(() => { zoomStart = null }, 300)
    if (!noUpdate) controls.update(controls.parseEvent(e))
    // TODO: replace 'nzoom'
    screen.setZoom(screen.nzoom - (noUpdate ? controls.od - controls.d : controls.d))
    // TODO: this should be a normalized method
    screen.setShift({
      x: controls.x / screen.zoom - controls.rx,
      y: controls.y / screen.zoom - controls.ry
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

  function handleDown (e) {
    controls.update(controls.parseEvent(e))
    controls.down = true
    timer = performance.now()
  }

  function handleMove (e) {
    e.preventDefault()
    if (controls.down) {
      const { x, y, d } = controls.parseEvent(e)
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
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
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

  window.addEventListener('wheel', handleZoom, { passive: false })
  window.addEventListener('mousedown', handleDown, { passive: false })
  window.addEventListener('touchstart', handleDown, { passive: false })
  window.addEventListener('mousemove', handleMove, { passive: false })
  window.addEventListener('touchmove', handleMove, { passive: false })

  window.addEventListener('mouseup', () => {
    controls.down = false
    if (performance.now() - timer < 200) {
      toggleSquare({ x: controls.nx, y: controls.ny })
    }
  })

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

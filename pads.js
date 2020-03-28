const calcOffset = v => v >= 0 ? v - (v | 0) : 1 - calcOffset(-v)

const debug = window.debug = {}

const colors = {
  grid: '#000', //'#222222',
  square: '#000'
}

export default function (el) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  let timer = 0

  let squares = debug.squares = localStorage.squares ? JSON.parse(localStorage.squares) : {}

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
      this.size.width = this.canvas.width / this.zoom
      this.size.height = this.canvas.height / this.zoom
    }
  }

  function resize() {
    screen.canvas.width = canvas.width = document.documentElement.clientWidth
    screen.canvas.height = canvas.height = document.documentElement.clientHeight
  }

  function clear () {
    context.clearRect(0, 0, screen.canvas.width, screen.canvas.height)
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

  const drawSquare = pos => {
    const [x, y] = pos.split(',')
    if (x >= Math.floor(-screen.shift.x) && y >= Math.floor(-screen.shift.y)
      && x <= Math.ceil(-screen.shift.x) + screen.size.width && y <= Math.ceil(-screen.shift.y) + screen.size.height) {
      context.fillStyle = colors.square
      context.fillRect(
        Math.floor(x * screen.zoom + screen.shift.x * screen.zoom) - 1,
        Math.floor(y * screen.zoom + screen.shift.y * screen.zoom) - 1,
        screen.zoom + 1,
        screen.zoom + 1
      )
    }
  }

  const clearSquare = pos => {
    const [x, y] = pos.split(',')
    if (x >= Math.floor(-screen.shift.x) && y >= Math.floor(-screen.shift.y)
      && x <= Math.ceil(-screen.shift.x) + screen.size.width && y <= Math.ceil(-screen.shift.y) + screen.size.height) {
      context.clearRect(
        Math.floor(x * screen.zoom + screen.shift.x * screen.zoom) - 1,
        Math.floor(y * screen.zoom + screen.shift.y * screen.zoom) - 1,
        screen.zoom + 1,
        screen.zoom + 1
      )
    }
  }

  const drawSquares = () => {
    Object.keys(squares).forEach(drawSquare)
  }

  const toggleSquare = pos => {
    const hash = `${pos.x},${pos.y}`

    if (hash in squares) {
      delete squares[hash]
      // clearSquare(hash)
      clear()
      render()
    } else {
      squares[hash] = true
      drawSquare(hash)
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

  function render () {
    drawGrid()
    drawSquares()
  }


  function handleZoom (e, noUpdate = false) {
    e.preventDefault()
    if (!noUpdate) controls.update(controls.parseEvent(e))
    // TODO: replace 'nzoom'
    screen.setZoom(screen.nzoom - (noUpdate ? controls.od - controls.d : controls.d))
    // TODO: this should be a normalized method
    screen.setShift({
      x: controls.x / screen.zoom - controls.rx,
      y: controls.y / screen.zoom - controls.ry
    })
    if (noUpdate) return
    clear()
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
      clear()
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

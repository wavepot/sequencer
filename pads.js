const calcOffset = v => v >= 0 ? v - (v | 0) : 1 - calcOffset(-v)

const debug = window.debug = {}

const colors = {
  grid: '#fff', //'#222222',
  square: '#333'
}

export default function (el) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  let timer = 0

  let squares = debug.squares = localStorage.squares ? JSON.parse(localStorage.squares) : {}

  const mouse = debug.mouse = {
    down: false,
    x: 0, y: 0, // absolute position
    rx: 0, ry: 0, // relative position
    nx: 0, ny: 0, // normalized position
    parseEvent (e) {
      this.setPosition({ x: e.clientX, y: e.clientY })
    },
    setPosition ({ x, y }) {
      this.x = x
      this.y = y
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
      this.zoom = localStorage.zoom = Math.max(5, Math.min(500, zoom))
      this.size.width = this.canvas.width / this.zoom
      this.size.height = this.canvas.height / this.zoom
    }
  }

  screen.setShift(localStorage.shift ? JSON.parse(localStorage.shift) : { x: 0, y: 0 })
  screen.setZoom(localStorage.zoom || 50)

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
    context.lineWidth = 1

    for (let x = 0; x < screen.size.width; x++) {
      drawHorizontalLine((x * screen.zoom + screen.offset.x * screen.zoom | 0) - .5)
    }

    for (let y = 0; y < screen.size.height; y++) {
      drawVerticalLine((y * screen.zoom + screen.offset.y * screen.zoom | 0) - .5)
    }

    context.restore()
  }

  function render () {
    drawGrid()
    drawSquares()
  }

  window.addEventListener('wheel', e => {
    e.preventDefault()
    mouse.parseEvent(e)

    // the delta coefficients are arbitrary values tuned manually for my trackpad (ThinkPad X1)
    const delta = Math.pow(3, -e.deltaY / 2000)

    // keep zoom over a minimum value and avoid fractions
    screen.setZoom(Math[e.deltaY > 0 ? 'floor' : 'ceil'](screen.zoom * delta))

    screen.setShift({
      x: mouse.x / screen.zoom - mouse.rx,
      y: mouse.y / screen.zoom - mouse.ry
    })

    clear()
    render()
  }, { passive: false })

  window.addEventListener('resize', () => {
    resize()
    render()
  })

  window.addEventListener('mousedown', e => {
    mouse.parseEvent(e)
    mouse.down = true
    timer = performance.now()
  })

  window.addEventListener('mousemove', e => {
    if (mouse.down) {
      if (timer && Math.abs(e.clientX - mouse.x) < 6 && Math.abs(e.clientY - mouse.y) < 6) return
      timer = 0
      const ox = mouse.x
      const oy = mouse.y
      mouse.parseEvent(e)
      screen.setShift({
        x: screen.shift.x - (ox - mouse.x) / screen.zoom, /// screen.zoom,
        y: screen.shift.y - (oy - mouse.y) / screen.zoom/// screen.zoom
      })
      clear()
      render()
    }
  })

  window.addEventListener('mouseup', () => {
    mouse.down = false
    if (performance.now() - timer < 200) {
      toggleSquare({ x: mouse.nx, y: mouse.ny })
    }
  })

  resize()
  render()
  el.appendChild(canvas)
}

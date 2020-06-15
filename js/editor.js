import { Primrose } from '../Primrose/js/package/index.js'

export const theme = {
  name: 'Darker',
  cursorColor: 'white',
  unfocused: 'rgba(0,0,0,0)',
  currentRowBackColor: '#202020',
  selectedBackColor: '#404040',
  lineNumbers: {
    foreColor: 'white'
  },
  regular: {
    backColor: 'black',
    foreColor: '#999'
  },
  strings: {
    foreColor: '#fff',
  },
  regexes: {
    foreColor: '#fff',
    fontStyle: 'italic'
  },
  numbers: {
    foreColor: '#fff'
  },
  comments: {
    foreColor: '#555',
  },
    keywords: {
    foreColor: '#fff'
  },
    operators: {
    foreColor: '#ccc'
  },
  symbol: {
    foreColor: '#ccc'
  },
  declare: {
    foreColor: '#fff'
  },
  functions: {
    foreColor: '#fff',
  },
  special: {
    foreColor: '#fff',
  },
  members: {
    foreColor: '#aaa'
  },
  error: {
    foreColor: 'red',
    fontStyle: 'underline'
  }
}

export const primroseOptions = {
  wordWrap: false,
  lineNumbers: false,
  fontSize: 16,
  padding: 0,
  width: 512,
  height: 512,
  scaleFactor: 1
}

export default class Editor {
  static createInstance (value) {
    const instance = new Primrose({
      theme,
      ...primroseOptions
    })
    if (value) instance.value = value
    return instance
  }

  constructor (grid, square, instance) {
    this.id = instance?.id ?? (Math.random() * 10e6 | 0).toString(36)
    this.instance = instance?.id ? instance : Editor.createInstance(instance)
    this.instance.id = this.id
    this.square = square
    this.offset = { x: 0, y: 0 }
    this.curr = { width: 512, height: 512 }
    this.prev = { width: 512, height: 512 }
    this.scale = 1
    this.zoomThreshold = 1300
    // TODO: change?
    // this.instance.addEventListener('change', this.updateListener)

    this.updateListener = this.draw.bind(this, grid)
    this.instance.addEventListener('update', this.updateListener)
  }

  toJSON () {
    return this.id
  }

  destroy () {
    // this.instance.removeEventListener('change', this.updateListener)
    this.instance.removeEventListener('update', this.updateListener)
  }

  draw (grid) {
    const { x, y } = this.square
    const screen = grid.screen

    let width, height
    width = height = Math.floor(grid.zoom)

    if (grid.zoom > screen.width && grid.zoom > screen.height) {
      if (grid.zoom > screen.width) {
        if (grid.zoom - screen.width > this.zoomThreshold) {
          this.scale = screen.width / (grid.zoom - this.zoomThreshold)
        }
      } else {
        if (grid.zoom - screen.height > this.zoomThreshold) {
          this.scale = screen.height / (grid.zoom - this.zoomThreshold)
        }
      }

      this.curr = {
        width: Math.min(width, screen.width) * this.scale,
        height: Math.min(height, screen.height) * this.scale
      }

      if (this.curr.width !== this.prev.width || this.curr.height !== this.prev.height) {
        this.instance.setSize(this.curr.width, this.curr.height)
        this.prev = this.curr
      }

      width = Math.min(width, screen.width)
      height = Math.min(height, screen.height)
    } else {
      this.curr = {
        width: Math.min(grid.zoom, screen.width),
        height: Math.min(grid.zoom, screen.height)
      }

      width = this.curr.width
      height = this.curr.height

      if (this.curr.width !== this.prev.width || this.curr.height !== this.prev.height) {
        this.instance.setSize(this.curr.width, this.curr.height)
        this.prev = this.curr
      }
    }

    this.offset = {
      x: Math.floor(x * grid.zoom + grid.shift.x * grid.zoom),
      y: Math.floor(y * grid.zoom + grid.shift.y * grid.zoom)
    }

    grid.ctx.imageSmoothingEnabled = false
    grid.ctx.drawImage(
      this.instance.canvas,
      this.offset.x,
      this.offset.y,
      width,
      height
    )
  }
}

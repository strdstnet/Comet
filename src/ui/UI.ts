import blessed from 'blessed'

export class UI {

  protected screen = blessed.screen({
    smartCSR: true,
    title: 'Comet',
  })

  constructor() {
    // const box = blessed.box({
    //   top: 'center',
    //   left: 'center',
    //   width: '50%',
    //   height: '50%',
    //   content: '{bold}Comet{/bold}\nThe terminal based Minecraft (Bedrock) client',
    //   tags: true,
    //   border: {
    //     type: 'line',
    //   },
    //   style: {
    //     fg: 'white',
    //     bg: 'magenta',
    //     border: {
    //       fg: '#f0f0f0',
    //     },
    //     hover: {
    //       bg: 'green',
    //     },
    //   },
    // })
    this.screen.append(blessed.text({
      content: 'COMET',
      left: 'center',
    }))
    const play = this.button('PLAY', this.screen, {
      top: 5,
      left: 'center',
    })
    play.on('press', () => {
      play.setContent('PRESSED')
    })
    this.button('SETTINGS', this.screen, {
      top: 9,
      left: 'center',
    })
    // this.screen.append(box)

    this.screen.key(['escape', 'q', 'C-c'], function(ch, key) {
      return process.exit(0);
    })
    this.screen.render()
  }

  public button(content: string, parent: blessed.Widgets.Node, opts: blessed.Widgets.ButtonOptions = {}, cb?: () => void | Promise<void>) {
    const button = blessed.button({
      content,
      width: '50%',
      height: 3,
      shrink: true,
      padding: {
        top: 1,
        right: 5,
        bottom: 1,
        left: 5,
      },
      style: {
        bold: true,
        fg: 'white',
        bg: 'black',
        focus: {
          inverse: true,
        },
      },
      ...opts,
    })

    if(cb) {
      button.on('press', () => {
        cb()
        this.screen.render()
      })
    }

    parent.append(button)

    return button
  }

}
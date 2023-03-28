class Emitter {
  public subscriptions: {
    [key: string]: any;
  } = {};

  fire(event, ...rest) {
    const cbs = this.subscriptions[event] || [];
    for (let i = 0; i < cbs.length; i++) {
      cbs[i].apply(this, rest); // eslint-disable-line
    }
  }

  on(event, cb) {
    if (!this.subscriptions[event]) this.subscriptions[event] = [cb];
    else this.subscriptions[event].push(cb);

    return () => {
      const subscriptions = this.subscriptions[event];
      const index = subscriptions.indexOf(cb);
      if (index !== -1) subscriptions.splice(index, 1);
    };
  }

  off(event) {
    delete this.subscriptions[event];
  }
}

export default Emitter;

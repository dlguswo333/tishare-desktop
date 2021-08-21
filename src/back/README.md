This README is to follow the development.

## Improve JobView response time
- [x] Add ***sendState*** callback to Server, Client, Sender, Receiver, Requester, Requestee.
- [ ] Add ***ind*** to every ***state***s.
- [ ] Server: Call ***sendState*** everytime a progress occurs.
- [ ] Client: Call ***sendState*** everytime a progress occurs.
- [ ] Requester: Call ***sendState*** everytime a progress occurs.
- [ ] Requestee: Call ***sendState*** everytime a progress occurs.
- [ ] Sender: Call ***sendState*** everytime a progress occurs.
- [ ] Receiver: Call ***sendState*** everytime a progress occurs.
- [ ] Inflate all ***deleteCallback*** from `() => { this.deleteJob(ind); }` to `this.deleteJob` because now every Job knows its `ind`.

This README is to follow the development.

## Improve JobView response time
- [x] Add ***sendState*** callback to Server, Client, Sender, Receiver, Requester, Requestee.
- [x] Add ***ind*** to every ***state***s.
- [x] Server: Call ***sendState*** everytime a progress occurs.
- [x] Client: Call ***sendState*** everytime a progress occurs.
- [x] Requester: Call ***sendState*** everytime a progress occurs.
- [x] Requestee: Call ***sendState*** everytime a progress occurs.
- [ ] Sender: Call ***sendState*** everytime a progress occurs.
- [ ] Receiver: Call ***sendState*** everytime a progress occurs.
- [ ] Inflate all ***deleteCallback*** from `() => { this.deleteJob(ind); }` to `this.deleteJob` because now every Job knows its `ind`.

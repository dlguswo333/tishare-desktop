This README describes the implementations and logics behind `tiShare`.
<br>

# 1. Basic Idea
There are always a requester and a requestee when making a connection.
Also, there are always a sender and a receiver when transferring files.
tiShare is built onto the basic ideas.
Each device has an instance of requester and requestee.
When initiating transferring files, based on who requested, and
who is going to send or receive, an instance of sender or receiver will be
created within a requester or a requestee.
<br>

Sender and receiver communicates with `TCP` connection, which is a stream of data.
TCP connection splits data into packets, and those packet sizes can differ under various factors, such as OS, network interface, and etc.
<br>

That makes application layer networking a little bit hard, because once received data,
it **cannot be guranteed** that the data is in one piece, or splitted.
`tiShare` must distinguish between the metadata(header),
response and the actual file data. Otherwise it can write metadata into files.
<br>

To distinguish the header from actual data, 
the header always ends with two consecutive `\n`.
Upon failed to find `\n\n` in the data received, it means the header has been splitted,
telling to wait for remaining header to arrive.
Of course, the header itself should not have `\n\n` within it.
We can trust that is true because no one would not want to
name the file with some newline characters.
We will use JSON formatted header and `JSON.stringify` to convert header into stream format.
<br>

There are some cases where header is followed by binary data or not.
On any cases, the header is always encoded in `utf-8`.
JSON format is always in `utf-8`, anyway.
<br>

# 2. Scan
<!-- TODO Edit. No TCP, but UDP. -->
`tiShare` scan works with `UDP` sockets.
If you are to be exposed to other devices, you shall open your server socket
so that other devices can reach you.
<br>

There are two devices, one is scanner (Who initiates scan),
and the other is scannee (Who responds to scan).
Scanner starts scanning by sending datagram packets to the local broadcast IP.
**NOTE** that port number is constant across `tiShare`.

If scanner sends a header like the following:
```json
{
  "app": "tiShare",
  "version": "0.2.0",
  "class": "scan",
  "id": "device_1",
  "os": "win32"
}
```
Each field has its own meaning, and the field names tell what they mean.
<br>

If scannee that is the other side of TCP connection is truly `tiShare`,
then it sends back the below header to the scanner:
```json
{
  "app": "tiShare",
  "version": "0.2.0",
  "class": "scan",
  "id": "device_2",
  "os": "linux"
}
```
<br>

Once the scanner received a header, it recognizes the scannee and its IP address.
<br>

# 3. Send Request
Sender connects to receiver and sends the following header first.
```json
{
  "app": "tiShare",
  "version": "0.2.0",
  "class": "send-request",
  "id": "device_1",
}
```
The above `json` data is stringified and followed by `\n\n`, which notifies the end of the header, as stated [above](#basic-idea).
<br>

There is no data following after `\n\n`. Sender sends the header and goes to `RQR_SEND_REQUEST` state, waiting for receiver to accept or reject.
The following describes the header in sender's perspective.
<br>

| Key | Description |
| :--- | :--- |
| `app` | `tiShare` always. |
| `version` | the version of sender's `tiShare` app. |
| `class` | `send-request` always. |
| `numItems` | the number of total items. |

Then, sender waits for data from receiver.
Then receiver sends the following data,
and it shall be a header, without any following data but `\n\n`.
<br>
```json
{
  "class": "ok"
}
```

| Key | Description |
| :--- | :--- |
| `response` | `ok`: Requestee agreed to receive.<br> `no`: Requestee rejected. |
<br>


# 4. While Sending and Receiving
Data chunk size is **fixed**,
so sender always write a chunk into socket at once,
and receiver tries to receive so long as
the received chunk size equals the size in the header.
<br>

## Sender
Sender always sends a header with or without a chunk(Actual contents of items).
If sender wants to send for the first time for a item, header looks like this:
<br>

```json
{
  "class": "new",
  "name": "file_1",
  "dir": ".",
  "type": "file",
  "size": 1000
}
```
| Key | Description |
| :--- | :--- |
| `class` | Always `new`. It means sender want to send this item. |
| `name` | Name of the item. |
| `dir` | Relative directory of the item.<br> That is, if a item named `dir_1` which is a directory contains a file `file_2`, `file_2`'s `dir` value is (`dir_1`'s `dir` value) + `/` + (`dir_1`)
| `type` | Type of the item. Either `file` or `directory`. |
| `size` | **Size of the whole item.**<br>Omitted if the item is directory. |
<br>

`size` is necessary for Receiver to detect malicious behavior of Sender. If the total size of chunks received exceeds the `size` value in the `class=new` header, it will send a `class=next` header to skip the item.
<br>

When sender sends actual contents of the item, header looks like the following.
<br>

```json
{
  "class": "ok",
  "size": 1234,
}
```
| Key | Description |
| :--- | :--- |
| `class` | `ok`: Sender wants to keep sending. Chunk is followed after the header.<br>`done`: Sender sent all items thus notifies receiver completion.<br>`end`: Sender wants to end permanently.<br> |
| `size` | **Size of the following chunk.** |
<br>

## Receiver
While Receiving, receiver sends header only.
Receivers header looks like this.
<br>

```json
{
  "class": "ok"
}
```
| Key | Description |
| :--- | :--- |
| `class` | `ok`: Receiver is good to receiver another chunk or next item.<br>`next`: Receiver wants to skip this item because of unwanted or some errors with the item.<br>`end`: Receiver wants to end permanently.<br> |

# 5. Development Notes

## `error` Event of TCP Socket
According to the [docs](https://nodejs.org/docs/latest-v14.x/api/net.html#net_event_error_1), `error` event is immediately followed by `close` event. So handling errors is unnecessary since we can handle `close` event more vastly.
<br>

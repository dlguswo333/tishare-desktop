This README describes the implementations and logics behind `SendDone`.
<br>

# 1. Basic Idea
Sender and receiver communicates with `TCP` connection, which is a stream of data.<br>
TCP connection splits data into packets, and those packet sizes can differ under various factors, such as OS, network interface, and etc.<br>
That makes application layer networks a little bit hard, because once received data, it cannot be guranteed that the data is intact, or is splitted.<br>
Thus `SendDone` must distinguish between the metadata(header), response and the actual file data. Otherwise it can write metadata into files.<br>
To distinguish the header from actual data, the header always ends with two consecutive `\n`.<br>
Upon failed to find `\n\n` in the data received, it means the header has been splitted, telling to wait for remaining header to arrive.<br>
Of course, the header should not have `\n\n` within it.<br>
We will use JSON formatted header and `JSON.stringify` to convert header into stream format.
<br>

There are some cases where header is followed by binary data or not.<br>
On any cases, the header is always encoded in `utf-8`.
<br>

# 2. Scan
`SendDone` scan works with TCP sockets.<br>
If you are to be exposed to other devices, you shall open your server socket<br>
so that other devices can reach you.
<br>

There are two devices, one is scanner(Who initiates scan),<br>
and the other is scannee(Who responds to scan).<br>
Scanner(Who initiates scan) starts with the first IP address with the given local area network(LAN).<br>
**NOTE** that port number is constant.<br>
Loop each IP, and finalize with the last IP address in that LAN.<br>
For example, if the LAN is 192.168.0.1/24, then starts with 192.168.0.0,<br>
finishes with 192.168.0.254.<br>
**NOTE** that It should not connect to itself, and need not connect to broadcast IP.
<br>

If scanner successfully connects to an IP address, it sends a header like the following:
```json
{
  "app": "SendDone",
  "version": "0.1.0",
  "class": "scan",
  "id": "device_1",
  "os": "win32"
}
```
Each field has its own meaning, and the meaning is clear from its name.
<br>

If scannee that is the other side of TCP connection is truly `SendDone`,<br>
then it sends back this header to the scanner:
```json
{
  "app": "SendDone",
  "version": "0.1.0",
  "class": "ok",
  "id": "device_2",
  "os": "linux"
}
```
<br>

# 3. Send Request
Sender connects to receiver and sends the following header first.
```json
{
  "app": "SendDone",
  "version": "0.1.0",
  "class": "send-request",
  "id": "device_1",
  "itemArray": [
    {
      "name": "file_1",
      "type": "file",
      "size": 1234
    },
    {
      "name": "file_2",
      "type": "file",
      "size": 4321
    },
    {
      "name": "sub_directory",
      "type": "directory"
    },
    {
      "name": "sub_directory/file_1",
      "type": "file",
      "size": 1000
    }
  ]
}
```
The above `json` data is stringified and followed by `\n\n`, which notifies the end of the header, as stated [above](#basic-idea).<br>
There is no following data after `\n\n`. Sender sends the header and goes to `SEND_REQUEST` state, waiting for receiver to accept or reject.<br>
The following describes the header in sender's perspective.
<br>

| Key | Description |
| :--- | :--- |
| `app` | `SendDone` is fixed value. |
| `version` | the version of sender's `SendDone` app. |
| `class` | `send-request` is fixed value. |
| `itemArray` | The array of items to send and receive.<br>File consists of `name`, `type`, and `size`.<br>Directory consists of `name` and `type`.

Then, sender waits for receiver to send a sign.
<br>

Then receiver sends the following data,<br>
and it shall be a header, without any following data. Only `\n\n` is followed.<br>
```json
{
  "class": "ok"
}
```

| Key | Description |
| :--- | :--- |
| `response` | `ok`: Receiver agreed to receive.<br> `no`: Receiver rejected. |
<br>


# 4. While Sending and Receiving
Data chunk size is **fixed**, so sender always write a chunk into socket at once,<br>
and receiver iterates until the received chunk size is equal to the size in the header.
<br>

## Sender
Sender always sends header with or without chunk(Actual contents of items).<br>
If sender wants to send for the first time for this item, header looks like this:
<br>

```json
{
  "class": "new",
  "name": "file_1",
  "type": "file",
  "size": 1000
}
```
| Key | Description |
| :--- | :--- |
| `class` | Always `new`. It means sender want to send this item. |
| `name` | Name of the item. |
| `type` | Type of the item. Either `file` or `directory`. |
| `size` | **Size of the whole item.**<br>Omitted if the item is directory. |
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
| `class` | `ok`: Sender wants to keep sending. Chunk is followed after the header.<br>`done`: Sender sent all items thus notifies receiver completion.<br>`stop`: Sender wants to stop for a time.<br>`end`: Sender wants to end permanently.<br> |
| `size` | **Size of the following chunk.** |
<br>

## Receiver
While Receiving, receiver sends header only.<br>
Receivers header looks like this.
<br>

```json
{
  "class": "ok"
}
```
| Key | Description |
| :--- | :--- |
| `class` | `ok`: Receiver is good to receiver another chunk or next item.<br>`next`: Receiver wants to skip this item because of unwanted or some errors with the item.<br>`stop`: Receiver wants to stop for a time.<br>`end`: Receiver wants to end permanently.<br> |

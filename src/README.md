# networking.js
This section explains the logic behind `networking.js`.
<br>

## Section
> [Basic Idea](#basic-idea)<br>
> [Scan](#scan)<br>
> [Send Request](#send-request)<br>
> [While Sending and Receiving](#while-sending-and-receiving)<br>

`src/networking.js` is the underline implementation of TCP networks and file write and read.<br>
Receiver always opens a server socket, and sender always connects to the server socket as a client.<br>
Why? Because that is easier and more natural than the opposite way.<br>
Think of a mouth and an ear. Mouth always initiate communication, and ear responds to the mouth.<br> 
To communicate at any arbitrary time, ear has to be open always, while mouth does not have to be.
<br>

## Basic Idea
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

## Scan
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
  "id": "device_1"
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
  "id": "device_2"
}
```

## Send Request
Sender connects to receiver and sends the following header first.
```json
{
  "app": "SendDone",
  "version": "0.1.0",
  "class": "send-request",
  "id": "device_1",
  "array": [
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
| `array` | The array of elements to send and receive.<br>File consists of `name`, `type`, and `size`.<br>Directory consists of `name` and `type`.

Then, sender waits for receiver to send a sign.<br>
Then receiver sends the following data, and it shall be a header, without any following data. Only `\n\n` is followed.<br>
```json
{
  "class": "ok"
}
```

| Key | Description |
| :--- | :--- |
| `response` | `ok`: Switch state to `SEND` and start sending.<br> `no`: Switch state to `SEND_REJECT` and do not send. |

## While Sending and Receiving
Upon receiving `ok` sign after sending send request header, sender initiates sending with the first element's metadata, and the corresponding data chunk.<br>
```json
{
  "class": "ok"
}
```
| Key | Description |
| :--- | :--- |
| `class` | `ok`: Sender wants to keep sending.<br>`stop`: Sender wants to stop for a time.<br>`end`: Sender wants to end permanently. |

The header always looks like this, having only one key `class`.<br>
After parsing the header from sender, only if `class` is `ok`, receiver sends a header, which is absolutely same as above.
<br>

Say both sender and receiver agree to keep sending and receiving.<br>
Then sender sends next file chunk, following a header.<br>
**NOTE** that if the element's type is `directory`, no need to send data.<br>
Receiver can just make directory inside the receiving directory.

Data chunk size is **fixed**, so sender always write a chunk into socket at once,<br>
and receiver iterates until one whole chunk has been received.<br>
**But** what if the size of the file is zero or the last chunk of the file is smaller than the fixed chunk size?<br>
Receiver keeps track of the array of the elements and each size from the send request header and the total length written so far for this element.<br>
If the total length written for this file is equal to the file size, receiver can stop writing or waiting for more data and sends `ok` sign.
<br>

import {notStrictEqual, strictEqual, ok} from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {randomBytes} from 'crypto';
import Indexer from './Indexer.js';
import Server from './Server.js';
import Client from './Client.js';
import {MAX_NUM_JOBS, STATE} from '../defs.js';
import {getBroadcastIp, isLocalIp} from './Network.js';
import {after} from 'mocha';
import {createCert} from './ts/cert.js';

describe('Indexer', () => {
  const indexer = new Indexer(() => { }, () => { });
  /** @type {number[]} */
  const indices = [];
  it('Unique index', () => {
    for (let i = 0; i < MAX_NUM_JOBS; ++i) {
      const ind = indexer.getInd();
      notStrictEqual(ind, -1);
      strictEqual(indices.includes(ind), false);
      indices.push(ind);
    }
  });
  it('Return -1 if no rooms available', () => {
    strictEqual(indexer.getInd(), -1);
  });
  it('Get valid indices after return', () => {
    ok(indexer.returnInd(indices[0]));
    let ind = indexer.getInd();
    notStrictEqual(ind, -1);
    strictEqual(indices.includes(ind), false);
    indices.push(ind);
  });
  it('Return -1 if no rooms available again', () => {
    ok(indexer.getInd() === -1);
  });
});

describe('Network', () => {
  describe('Get Broadcast IP', () => {
    const ip = '192.168.0.1';
    it('Test 1', () => {
      const netmask = '255.255.255.0';
      const expected = '192.168.0.255';
      strictEqual(getBroadcastIp(ip, netmask), expected);
    });
    it('Test 2', () => {
      const netmask = '255.255.0.0';
      const expected = '192.168.255.255';
      strictEqual(getBroadcastIp(ip, netmask), expected);
    });
    it('Test 3', () => {
      const netmask = '255.255.255.128';
      const expected = '192.168.0.127';
      strictEqual(getBroadcastIp(ip, netmask), expected);
    });
  });
  describe('Determine is IP local', () => {
    it('Test 1', () => {
      strictEqual(isLocalIp('192.168.0.1'), true);
    });
    it('Test 2', () => {
      strictEqual(isLocalIp('11.111.0.1'), false);
    });
    it('Test 3', () => {
      strictEqual(isLocalIp('10.11.101.200'), true);
    });
  });
});

describe('Server and client', async () => {
  const cert = await createCert();
  if (cert === null) {
    throw new Error('creating certificates failed');
  }
  const indexer = new Indexer(() => {}, () => {});
  const server = new Server(indexer, () => {}, cert);
  const client = new Client(indexer, () => {}, cert);
  const ip = '127.0.0.1';
  const netmask = '255.0.0.0';
  const serverId = 'server';
  const clientId = 'client';

  describe('Server', () => {
    it('not null', () => {
      ok(server);
    });
    it('reject open if ID is empty', () => {
      strictEqual(server.open(ip, netmask), false);
    });
    it('set ID', () => {
      server.setMyId(serverId);
      strictEqual(server.myId, serverId);
    });
    it('open', () => {
      strictEqual(server.open(ip, netmask), true);
    });
    it('close', () => {
      strictEqual(server.close(), true);
    });
  });

  describe('Client', async () => {
    /** @type {null | Object.<string, import('../types').TiItem>} */
    let items = null;

    before(async () => {
      items = await createItems();
    });

    it('not null', () => {
      ok(client);
      ok(items);
    });
    it('reject initiating if ID is empty', async () => {
      if (!items) {
        return ok(items);
      }
      strictEqual(await client.sendRequest(items, ip, serverId), false);
    });
    it('set ID', () => {
      client.setMyId(clientId);
      strictEqual(client.myId, clientId);
    });

    after(async () => {
      if (items !== null) {
        await deleteItems(items);
      }
    });
  });

  describe('Transfer', () => {
    it('Transfer a 10MiB file', async function () {
      this.timeout(30000);
      const fileName = 'file';
      const fileSize = 10 * 1024 * 1024;
      const srcDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiShare-test-src'));
      const recvDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiShare-test-recv'));
      try {
        const filePath = path.join(srcDir, fileName);
        const handle = await fs.open(filePath, 'w');
        const srcBytes = randomBytes(fileSize);
        await handle.write(srcBytes);
        await handle.close();

        server.setMyId(serverId);
        server.open(ip, netmask);

        /** @type {Object.<string, import('../types').TiItem>} */
        const items = {[fileName]: {dir: '.', name: fileName, path: filePath, type: 'file', size: fileSize}};
        client.setMyId(clientId);
        const ret = await client.sendRequest(items, ip, serverId);
        notStrictEqual(ret, false);
        const clientInd = /** @type {number} */ (ret);

        /** @type {number} */
        let serverInd = -1;
        await waitFor(() => {
          for (const [key, job] of Object.entries(server.jobs)) {
            if (job.getState().state === STATE.RQE_SEND_REQUEST) {
              serverInd = Number(key);
              return true;
            }
          }
          return false;
        }, 'Server did not receive the send request');

        server.acceptSendRequest(serverInd, recvDir);

        await waitFor(() => {
          const clientState = client.jobs[clientInd]?.getState().state;
          const serverState = server.jobs[serverInd]?.getState().state;
          return clientState === STATE.SEND_COMPLETE && serverState === STATE.RECV_COMPLETE;
        }, 'Transfer did not complete');

        const recvPath = path.join(recvDir, fileName);
        const recvBytes = await fs.readFile(recvPath);
        ok(srcBytes.equals(recvBytes));
        server.deleteJob(serverInd);
        client.deleteJob(clientInd);
      } finally {
        server.close();
        await fs.rm(srcDir, {recursive: true, force: true});
        await fs.rm(recvDir, {recursive: true, force: true});
      }
    });

    it('Transfer an already-existing file', async function () {
      this.timeout(30000);
      const fileName = 'file';
      const fileSize = 1024;
      const srcDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiShare-test-src'));
      const recvDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiShare-test-recv'));
      try {
        const srcFilePath = path.join(srcDir, fileName);
        const dstFilePath = path.join(recvDir, fileName);
        const srcBytes = randomBytes(fileSize);
        const dstBytes = randomBytes(fileSize);
        await fs.writeFile(srcFilePath, srcBytes);
        await fs.writeFile(dstFilePath, dstBytes);

        server.setMyId(serverId);
        server.open(ip, netmask);

        /** @type {Object.<string, import('../types').TiItem>} */
        const items = {[fileName]: {dir: '.', name: fileName, path: srcFilePath, type: 'file', size: fileSize}};
        client.setMyId(clientId);
        const ret = await client.sendRequest(items, ip, serverId);
        notStrictEqual(ret, false);
        const clientInd = /** @type {number} */ (ret);

        /** @type {number} */
        let serverInd = -1;
        await waitFor(() => {
          for (const [key, job] of Object.entries(server.jobs)) {
            if (job.getState().state === STATE.RQE_SEND_REQUEST) {
              serverInd = Number(key);
              return true;
            }
          }
          return false;
        }, 'Server did not receive the send request');

        server.acceptSendRequest(serverInd, recvDir);

        await waitFor(() => {
          const clientState = client.jobs[clientInd]?.getState().state;
          const serverState = server.jobs[serverInd]?.getState().state;
          return clientState === STATE.SEND_COMPLETE && serverState === STATE.RECV_COMPLETE;
        }, 'Transfer did not complete');

        ok(dstBytes.equals(await fs.readFile(dstFilePath)));
        server.deleteJob(serverInd);
        client.deleteJob(clientInd);
      } finally {
        server.close();
        await fs.rm(srcDir, {recursive: true, force: true});
        await fs.rm(recvDir, {recursive: true, force: true});
      }
    });

    it('Preserve an already-existing file when the sender cancels after it is skipped', async function () {
      this.timeout(30000);
      const fileName = 'file';
      const fileSize = 1024;
      const srcDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiShare-test-src'));
      const recvDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tiShare-test-recv'));
      try {
        const srcFilePath = path.join(srcDir, fileName);
        const dstFilePath = path.join(recvDir, fileName);
        const srcBytes = randomBytes(fileSize);
        const dstBytes = randomBytes(fileSize);
        await fs.writeFile(srcFilePath, srcBytes);
        await fs.writeFile(dstFilePath, dstBytes);

        server.setMyId(serverId);
        server.open(ip, netmask);

        /** @type {Object.<string, import('../types').TiItem>} */
        const items = {[fileName]: {dir: '.', name: fileName, path: srcFilePath, type: 'file', size: fileSize}};
        client.setMyId(clientId);
        const ret = await client.sendRequest(items, ip, serverId);
        notStrictEqual(ret, false);
        const clientInd = /** @type {number} */ (ret);

        /** @type {number} */
        let serverInd = -1;
        await waitFor(() => {
          for (const [key, job] of Object.entries(server.jobs)) {
            if (job.getState().state === STATE.RQE_SEND_REQUEST) {
              serverInd = Number(key);
              return true;
            }
          }
          return false;
        }, 'Server did not receive the send request');

        // Cancel as soon as the receiver skips the existing file. Intercept the
        // acknowledgement to make the ordering deterministic, before the sender
        // can finish the transfer in response to 'next'.
        const requestee = server.jobs[serverInd];
        ok('socket' in requestee);
        let skippedExistingFile = false;
        const requesteeSocket = requestee.socket;
        const origWrite = requesteeSocket.write;
        /**
         * @param {string | Uint8Array} arg1
         * @param {BufferEncoding | ((err?: Error | null) => void)} [arg2]
         * @param {(err?: Error | null) => void} [arg3]
         */
        const interceptWrite = function (arg1, arg2, arg3) {
          const header = JSON.parse(arg1.toString());
          if (header.class === 'next') {
            skippedExistingFile = true;
            client.endJob(clientInd);
            requesteeSocket.write = origWrite;
          }
          if (typeof arg2 === 'function') {
            return Reflect.apply(origWrite, requesteeSocket, [arg1, arg2]);
          }
          if (arg2 !== undefined) {
            return Reflect.apply(origWrite, requesteeSocket, [arg1, arg2, arg3]);
          }
          return Reflect.apply(origWrite, requesteeSocket, [arg1]);
        };
        requesteeSocket.write = interceptWrite;

        server.acceptSendRequest(serverInd, recvDir);

        await waitFor(() => {
          return server.jobs[serverInd]?.getState().state === STATE.OTHER_END;
        }, 'Receiver did not handle cancellation after skipping the existing file');

        // OTHER_END is published before the asynchronous removal finishes.
        // Wait for the socket to close before inspecting the destination.
        await waitFor(() => requesteeSocket.destroyed, 'Receiver did not close the cancelled connection');
        ok(skippedExistingFile, 'Receiver must skip the duplicate before cancellation');
        const remainFile = await fs.stat(dstFilePath).catch(() => null);
        ok(remainFile, 'The pre-existing file is deleted.');
        const remainingBytes = await fs.readFile(dstFilePath);
        ok(dstBytes.equals(remainingBytes), 'The pre-existing file has been modified.');
        server.deleteJob(serverInd);
      } finally {
        server.close();
        await fs.rm(srcDir, {recursive: true, force: true});
        await fs.rm(recvDir, {recursive: true, force: true});
      }
    });
  });
});

/**
 * Wait until the condition becomes true or the timeout expires. Busy waiting.
 * @param {() => boolean} cond
 * @param {string} message
 * @param {number} timeout
 */
async function waitFor (cond, message, timeout = 10000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) {
      throw new Error(message);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function createItems () {
  /** @type {Object.<string, import('../types').TiItem>} */
  const items = {};
  const n1 = 'file1';
  const n1size = 100;

  items[n1] = {dir: 'ddd', name: n1, path: path.join(import.meta.dirname, n1), type: 'file', size: n1size};
  const n1handle = await fs.open(items[n1].path, 'w');
  await n1handle.write(randomBytes(n1size));
  await n1handle.close();
  return items;
}

/**
 * @param {Object.<string, import('../types').TiItem>} items
 */
async function deleteItems (items) {
  for (let itemName in items) {
    await fs.rm(items[itemName].path, {force: true});
  }
}

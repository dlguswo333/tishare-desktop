const assert = require('assert')
const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const Indexer = require('./Indexer')
const Server = require('./Server')
const Client = require('./Client')
const { MAX_NUM_JOBS } = require('../defs')
/** @typedef {{dir:string, path:string, type:string, size:number}} Item */

describe('Indexer', () => {
  const indexer = new Indexer(() => { })
  const indices = []
  it('Unique index', () => {
    for (let i = 0; i < MAX_NUM_JOBS; ++i) {
      const ind = indexer.getInd()
      assert.notStrictEqual(ind, -1)
      assert.strictEqual(indices.includes(ind), false)
      indices.push(ind)
    }
  })
  it('Return -1 if no rooms available', () => {
    assert.strictEqual(indexer.getInd(), -1)
  })
  it('Get valid indices after return', () => {
    assert.ok(indexer.returnInd(indices[0]))
    let ind = indexer.getInd()
    assert.notStrictEqual(ind, -1)
    assert.strictEqual(indices.includes(ind), false)
    indices.push(ind)
  })
  it('Return -1 if no rooms available again', () => {
    assert.ok(indexer.getInd() === -1)
  })
})

describe('Server and client', () => {
  const indexer = new Indexer(() => { })
  const server = new Server(indexer)
  const client = new Client(indexer)
  const ip = '127.0.0.1'
  const netmask = '255.0.0.0'
  const serverId = 'server'
  const clientId = 'client'
  describe('Server', () => {
    it('not null', () => {
      assert.ok(server)
    })
    it('reject open if ID is empty', () => {
      assert.strictEqual(server.open(ip, netmask), false)
    })
    it('set ID', () => {
      server.setMyId(serverId)
      assert.strictEqual(server.myId, serverId)
    })
    it('open', () => {
      assert.strictEqual(server.open(ip, netmask), true)
    })
    it('close', () => {
      assert.strictEqual(server.close(), true)
    })
  })
  describe('Client', async () => {
    /** @type {Object.<string, Item>} */
    let items = null
    before(async () => {
      items = await createItems()
    })

    it('not null', () => {
      assert.ok(client)
    })
    it('reject initiating if ID is empty', async () => {
      assert.strictEqual(await client.sendRequest(items, ip, serverId), false)
    })
    it('set ID', () => {
      client.setMyId(clientId)
      assert.strictEqual(client._myId, clientId)
    })

    after(async () => {
      await deleteItems(items)
    })
  })
})

async function createItems() {
  const items = {}
  const n1 = 'file1'
  const n1size = 100

  items[n1] = { dir: 'ddd', path: path.join(__dirname, n1), type: 'file', size: n1size }
  const n1handle = await fs.open(items[n1].path, 'w')
  await n1handle.write(crypto.randomBytes(n1size))
  await n1handle.close()
  return items
}

/**
 * @param {Object.<string, Item} items
 */
async function deleteItems(items) {
  for (let itemName in items) {
    await fs.rm(items[itemName].path, { force: true })
  }
}
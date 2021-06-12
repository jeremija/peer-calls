jest.mock('../window')
jest.mock('../actions/CallActions')

import React from 'react'
import ReactDOM from 'react-dom'
import TestUtils from 'react-dom/test-utils'
import { Provider } from 'react-redux'
import { dial } from '../actions/CallActions'
import { DEVICE_DEFAULT_ID, DEVICE_DISABLED_ID, DIAL, DIAL_STATE_HUNG_UP, DIAL_STATE_IN_CALL, ME, MEDIA_ENUMERATE } from '../constants'
import { MediaConstraint } from '../reducers/media'
import { createStore, Store } from '../store'
import { MediaStream } from '../window'
import { Media } from './Media'

describe('Media', () => {

  beforeEach(() => {
    (dial as jest.Mock).mockClear()
    store = createStore()
    store.dispatch({
      type: MEDIA_ENUMERATE,
      status: 'resolved',
      payload: [{
        id: '123',
        name: 'Audio Input',
        type: 'audioinput',
      }, {
        id: '456',
        name: 'Video Input',
        type: 'videoinput',
      }],
    })
  })

  let store: Store
  async function render() {
    const div = document.createElement('div')
    const node = await new Promise<HTMLDivElement>(resolve => {
      ReactDOM.render(
        <div ref={div => resolve(div!)}>
          <Provider store={store}>
            <Media />
          </Provider>
        </div>,
        div,
      )
    })
    return node.children[0]
  }

  describe('submit', () => {
    const stream = new MediaStream()
    let promise1: Promise<MediaStream>

    let dialPromise: Promise<void>
    let dialResolve: () => void
    let dialReject: (err: Error) => void
    beforeEach(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        promise1 = Promise.resolve(stream)
        return promise1
      }
      dialPromise = new Promise((resolve, reject) => {
        dialResolve = resolve
        dialReject = reject
      })
      ;(dial as jest.Mock).mockImplementation(() => {
        dialResolve()
        return {
          status: 'resolved',
          type: DIAL,
        }
      })
    })
    it('retrieves audio/video stream and dials the call', async () => {
      const node = (await render()).querySelector('.media')!
      expect(node.tagName).toBe('FORM')
      TestUtils.Simulate.submit(node)
      expect(promise1).toBeDefined()
      await promise1
      await dialPromise
      expect(store.getState().media.dialState).toBe(DIAL_STATE_IN_CALL)
    })
    it('does not dial when stream is not available', async () => {
      navigator.mediaDevices.getUserMedia = async () => {
        promise1 = Promise.reject(new Error('test stream error'))
        return promise1
      }
      const root = await render()
      const node = root.querySelector('.media')!
      expect(node.tagName).toBe('FORM')
      TestUtils.Simulate.submit(node)
      expect(promise1).toBeDefined()
      let err!: Error
      try {
        await promise1
      } catch (e) {
        err = e
      }
      expect(err).toBeTruthy()
      expect(err.message).toBe('test stream error')
      expect(store.getState().media.dialState).toEqual(DIAL_STATE_HUNG_UP)
      await new Promise(resolve => setImmediate(resolve))
      expect(root.textContent).toMatch(/access to microphone/)
    })
    it('returns  to hung up state when dialling fails', async () => {
      (dial as jest.Mock).mockImplementation(() => {
        dialReject(new Error('test dial error'))
        return {
          status: 'rejected',
          type: DIAL,
        }
      })
      const node = (await render()).querySelector('.media')!
      expect(node.tagName).toBe('FORM')
      TestUtils.Simulate.submit(node)
      expect(promise1).toBeDefined()
      await promise1
      let err!: Error
      try {
        await dialPromise
      } catch (e) {
        err = e
      }
      expect(err).toBeTruthy()
      expect(err.message).toBe('test dial error')
      expect(store.getState().media.dialState).toBe(DIAL_STATE_HUNG_UP)
      const nickname = store.getState().nicknames[ME]
      expect((dial as jest.Mock).mock.calls).toEqual([[ { nickname } ]])
    })
  })

  describe('options', () => {
    it('should populate audio options', async () => {
      const node = await render()
      const options = Array.from(
        node.querySelectorAll('select[name=audio-input] option')!,
      )
      expect(options.map(o => o.getAttribute('value'))).toEqual([
        DEVICE_DISABLED_ID,
        DEVICE_DEFAULT_ID,
        '123',
      ])
      expect(options.map(o => o.textContent!.trim())).toEqual([
        'No Audio',
        'Default Audio',
        'Audio Input',
      ])
    })

    it('should populate video options', async () => {
      const node = await render()
      const options = Array.from(
        node.querySelectorAll('select[name=video-input] option')!,
      )
      expect(options.map(o => o.getAttribute('value'))).toEqual([
        DEVICE_DISABLED_ID,
        DEVICE_DEFAULT_ID,
        '456',
      ])
      expect(options.map(o => o.textContent!.trim())).toEqual([
        'No Video',
        'Default Video',
        'Video Input',
      ])
    })
  })

  describe('onVideoChange', () => {
    it('calls setVideoConstraint', async () => {
      const node = await render()
      const select = node.querySelector('select[name=video-input]')!

      const tests: {value: string, expected: MediaConstraint}[] = [{
        value: 'disabled',
        expected: {enabled: false, constraints: {facingMode: 'user'}},
      }, {
        value: '',
        expected: {enabled: true, constraints: {facingMode: 'user'}},
      }, {
        value: 'abcd',
        expected: {enabled: true, constraints: {deviceId: 'abcd'}},
      }]

      tests.forEach(test => {
        TestUtils.Simulate.change(select, {
          target: {
            value: test.value,
          } as any,
        })
        expect(store.getState().media.video).toEqual(test.expected)
      })
    })
  })

  describe('onAudioChange', () => {
    it('calls setAudioConstraint', async () => {
      const node = await render()
      const select = node.querySelector('select[name=audio-input]')!

      const tests: {value: string, expected: MediaConstraint}[] = [{
        value: 'disabled',
        expected: {enabled: false, constraints: {}},
      }, {
        value: '',
        expected: {enabled: true, constraints: {}},
      }, {
        value: 'abcd',
        expected: {enabled: true, constraints: {deviceId: 'abcd'}},
      }]

      tests.forEach(test => {
        TestUtils.Simulate.change(select, {
          target: {
            value: test.value,
          } as any,
        })
        expect(store.getState().media.audio).toEqual(test.expected)
      })
    })
  })

})

import omit from 'lodash/omit'
import uniqBy from 'lodash/uniqBy'
import { ConnectedAction, DialAction, DisconnectedAction, HangUpAction } from '../actions/CallActions'
import { DeviceId, MediaAction, MediaDevice, MediaDeviceToggle, MediaEnumerateAction, MediaPlayAction, MediaStreamAction, SizeConstraint } from '../actions/MediaActions'
import { DIAL, DialState, DIAL_STATE_DIALLING, DIAL_STATE_HUNG_UP, DIAL_STATE_IN_CALL, HANG_UP, MEDIA_DEVICE_ID, MEDIA_DEVICE_TOGGLE, MEDIA_ENUMERATE, MEDIA_PLAY, MEDIA_SIZE_CONSTRAINT, MEDIA_STREAM, SOCKET_CONNECTED, SOCKET_DISCONNECTED } from '../constants'

export interface MediaConstraint {
  constraints: MediaTrackConstraints
  enabled: boolean
}

export interface MediaState {
  socketConnected: boolean
  devices: {
    audio: MediaDevice[]
    video: MediaDevice[]
  }
  video: MediaConstraint
  audio: MediaConstraint
  dialState: DialState
  loading: boolean
  error: string
  autoplayError: boolean
}

const defaultConstraints = {
  video: { facingMode: 'user' },
  audio: {},
}

const defaultState: MediaState = {
  socketConnected: false,
  devices: {
    audio: [],
    video: [],
  },
  video: {
    enabled: true,
    constraints: defaultConstraints.video,
  },
  audio: {
    enabled: true,
    constraints: defaultConstraints.audio,
  },
  dialState: DIAL_STATE_HUNG_UP,
  loading: false,
  error: '',
  autoplayError: false,
}

function createDevices(devices: MediaDevice[]): MediaState['devices'] {
  const ret: MediaState['devices']  = {
    audio: [],
    video: [],
  }

  devices.forEach(device => {
    if (device.type === 'audioinput') {
      ret.audio.push(device)
    } else if (device.type === 'videoinput') {
      ret.video.push(device)
    }
  })

  ret.audio = uniqBy(ret.audio, d => d.id)
  ret.video = uniqBy(ret.video, d => d.id)

  return ret
}

export function handleEnumerate(
  state: MediaState,
  action: MediaEnumerateAction,
): MediaState {
  switch (action.status) {
    case 'resolved':
      return {
        ...state,
        loading: false,
        devices: createDevices(action.payload),
      }
      case 'pending':
        return {
          ...state,
          loading: true,
        }
      case 'rejected':
        return {
          ...state,
          loading: false,
          error: 'Could not retrieve media devices',
        }
  }
}

export function handleMediaStream(
  state: MediaState,
  action: MediaStreamAction,
): MediaState {
  switch (action.status) {
    case 'resolved':
      return {
        ...state,
      }
    case 'rejected':
      return {
        ...state,
        error: action.payload.message,
      }
    default:
      return state
  }
}

export function handlePlay(
  state: MediaState,
  action: MediaPlayAction,
): MediaState {
  switch (action.status) {
    case 'pending':
    case 'resolved':
      return {
        ...state,
        autoplayError: false,
      }
    case 'rejected':
      if (action.payload.name !== 'NotAllowedError') {
        return state
      }
      return {
        ...state,
        autoplayError: true,
      }
    default:
      return state
  }
}

export function handleDial(state: MediaState, action: DialAction): MediaState {
  switch(action.status) {
    case 'pending':
      return {
        ...state,
        dialState: DIAL_STATE_DIALLING,
      }
    case 'resolved':
      return {
        ...state,
        dialState: DIAL_STATE_IN_CALL,
      }
    case 'rejected':
      return {
        ...state,
        dialState: DIAL_STATE_HUNG_UP,
      }
    default:
      return state
  }
}

export function handleDeviceToggle(
  state: MediaState,
  payload: MediaDeviceToggle,
): MediaState {
  const deviceState = {
    ...state[payload.kind],
    enabled: payload.enabled,
  }

  return {
    ...state,
    [payload.kind]: deviceState,
  }
}


export function handleDeviceId(
  state: MediaState,
  payload: DeviceId,
): MediaState {
  let { constraints } = state[payload.kind]

  if (payload.deviceId !== '') {
    const defaultKeys = Object.keys(defaultConstraints[payload.kind])
    constraints = omit(constraints, defaultKeys)
    constraints.deviceId = payload.deviceId
  } else {
    constraints = omit(constraints, 'deviceId')
    constraints = {...constraints, ...defaultConstraints[payload.kind]}
  }

  return {
    ...state,
    [payload.kind]: {
      constraints,
      enabled: true,
    },
  }
}

export function handleSizeConstraint(
  state: MediaState,
  payload: SizeConstraint | null,
): MediaState {
  let { constraints } = state.video

  if (!payload) {
    constraints = omit(constraints, 'width', 'height')
  } else {
    constraints = {
      ...constraints,
      width: payload.width,
      height: payload.height,
    }
  }

  return {
    ...state,
    video: {
      ...state.video,
      constraints,
    },
  }
}

export default function media(
  state = defaultState,
  action:
    MediaAction |
    DialAction |
    HangUpAction |
    ConnectedAction |
    DisconnectedAction,
): MediaState {
  switch (action.type) {
    case MEDIA_ENUMERATE:
      return handleEnumerate(state, action)
    case MEDIA_DEVICE_ID:
      return handleDeviceId(state, action.payload)
    case MEDIA_DEVICE_TOGGLE:
      return handleDeviceToggle(state, action.payload)
    case MEDIA_SIZE_CONSTRAINT:
      return handleSizeConstraint(state, action.payload)
    case MEDIA_STREAM:
      return handleMediaStream(state, action)
    case MEDIA_PLAY:
      return handlePlay(state, action)
    case DIAL:
      return handleDial(state, action)
    case SOCKET_CONNECTED:
      return {
        ...state,
        socketConnected: true,
      }
    case SOCKET_DISCONNECTED:
      return {
        ...state,
        socketConnected: false,
      }
    case HANG_UP:
      return {
        ...state,
        dialState: DIAL_STATE_HUNG_UP,
      }
    default:
      return state
  }
}

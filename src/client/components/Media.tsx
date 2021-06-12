import classnames from 'classnames'
import React from 'react'
import { MdError } from 'react-icons/md'
import { connect } from 'react-redux'
import { dial } from '../actions/CallActions'
import { enumerateDevices, getDeviceId, getMediaStream, MediaDevice, MediaKind, play, setDeviceIdOrDisable, toggleDevice } from '../actions/MediaActions'
import { error, info, warning } from '../actions/NotifyActions'
import { DEVICE_DEFAULT_ID, DEVICE_DISABLED_ID, DialState, DIAL_STATE_HUNG_UP, ME } from '../constants'
import { MediaState } from '../reducers/media'
import { State } from '../store'
import { config } from '../window'
import { Alert, Alerts } from './Alerts'
import { Message } from './Message'
import { Unsupported } from './Unsupported'

const { network } = config

export type MediaProps = MediaState & {
  joinEnabled: boolean
  dial: typeof dial
  dialState: DialState
  visible: boolean
  enumerateDevices: typeof enumerateDevices
  setDeviceId: typeof setDeviceIdOrDisable
  getMediaStream: typeof getMediaStream
  play: typeof play
  logInfo: typeof info
  logWarning: typeof warning
  logError: typeof error
  nickname?: string
}

export interface MediaComponentState {
  nickname: string
  error?: boolean
}

function mapStateToProps(state: State) {
  return {
    ...state.media,
    nickname: state.nicknames[ME],
    joinEnabled:
      state.media.dialState === DIAL_STATE_HUNG_UP &&
      state.media.socketConnected &&
      !state.media.loading,
    visible: state.media.dialState === DIAL_STATE_HUNG_UP,
  }
}

const mapDispatchToProps = {
  enumerateDevices,
  dial,
  toggleDevice,
  setDeviceId: setDeviceIdOrDisable,
  getMediaStream,
  play,
  logInfo: info,
  logWarning: warning,
  logError: error,
}

const c = connect(mapStateToProps, mapDispatchToProps)

export class MediaForm
extends React.PureComponent<MediaProps, MediaComponentState> {
  constructor(props: MediaProps) {
    super(props)
    this.state = {
      nickname: props.nickname || '',
    }
  }

  componentDidMount() {
    this.props.enumerateDevices()
  }
  handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const { nickname } = this.state
    localStorage && (localStorage.nickname = nickname)
    event.preventDefault()
    const { props } = this
    const { audio, video } = props

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: false,
    }

    if (audio.enabled) {
      constraints.audio = audio.constraints
    }

    if (video.enabled) {
      constraints.video = video.constraints
    }

    try {
      await props.getMediaStream(constraints)
    } catch (err) {
      this.setState({ error: true })
      return
    }
    this.setState({ error: false })

    props.logInfo('Dialling...')
    try {
      await props.dial({
        nickname,
      })
    } catch (err) {
      props.logError('Error dialling: {0}', err)
    }
  }
  handleVideoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    this.handleChange('video', event.target.value)
  }

  handleAudioChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    this.handleChange('audio', event.target.value)
  }
  handleNicknameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ nickname: event.target.value })
  }
  handleChange = (kind: MediaKind, deviceId: string) => {
    this.props.setDeviceId({
      kind,
      deviceId,
    })
  }
  render() {
    const { props } = this
    const { audio, video } = props
    const { nickname } = this.state
    if (!props.visible) {
      return null
    }

    const videoId = getDeviceId(video.enabled, video.constraints)
    const audioId = getDeviceId(audio.enabled, audio.constraints)

    return (
      <form className='media' onSubmit={this.handleSubmit}>
        <div className='form-item'>
          <label className={classnames({ 'label-error': !nickname })}>
            Enter your name
          </label>
          <input
            required
            className={classnames({error: !nickname})}
            name='nickname'
            type='text'
            placeholder='Name'
            autoFocus
            onChange={this.handleNicknameChange}
            value={nickname}
          />
        </div>

        <div className='form-item'>
          <select
            name='video-input'
            onChange={this.handleVideoChange}
            value={videoId}
            autoComplete='off'
          >
            <Options
              devices={props.devices.video}
              default={DEVICE_DEFAULT_ID}
              type='videoinput'
            />
          </select>
        </div>

        <div className='form-item'>
          <select
            name='audio-input'
            onChange={this.handleAudioChange}
            value={audioId}
            autoComplete='off'
          >
            <Options
              devices={props.devices.audio}
              default={DEVICE_DEFAULT_ID}
              type='audioinput'
            />
          </select>
        </div>

        <button type='submit' disabled={!props.joinEnabled}>
          Join Call
        </button>

        {this.state.error && (
          <Message className='message-error'>
            <MdError className='icon' />
            <span>
              Could not get access to microphone or camera. Please grant the
              necessary permissions and try again.
            </span>
          </Message>
        )}

        <Unsupported />

        <div className='network-info'>
          <span>Network: {network}</span>
        </div>
      </form>
    )
  }
}

export interface AutoplayProps {
  play: () => void
}

export const AutoplayMessage = React.memo(
  function Autoplay(props: AutoplayProps) {
    return (
      <React.Fragment>
        Your browser has blocked video autoplay on this page.
        To continue with your call, please press the play button:
        &nbsp;
        <button className='button' onClick={props.play}>
          Play
        </button>
      </React.Fragment>
    )
  },
)

export const Media = c(React.memo(function Media(props: MediaProps) {
  return (
    <div className='media-container'>
      <Alerts>
        {props.autoplayError && (
          <Alert>
            <AutoplayMessage play={props.play} />
          </Alert>
        )}
      </Alerts>

      <MediaForm {...props} />
    </div>
  )
}))

interface OptionsProps {
  devices: MediaDevice[]
  type: 'audioinput' | 'videoinput'
  default: string
}

const labels = {
  audioinput: 'Audio',
  videoinput: 'Video',
}

function Options(props: OptionsProps) {
  const label = labels[props.type]
  return (
    <React.Fragment>
      <option value={DEVICE_DISABLED_ID}>No {label}</option>
      <option value={DEVICE_DEFAULT_ID}>Default {label}</option>
      {
        props.devices
        .map(device =>
          <option
            key={device.id}
            value={device.id}
          >
            {device.name || device.type}
          </option>,
        )
      }
    </React.Fragment>
  )
}

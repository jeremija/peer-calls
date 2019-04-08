import Alerts, { AlertPropType } from './Alerts.js'
import * as constants from '../constants.js'
import Toolbar from './Toolbar.js'
import Notifications, { NotificationPropTypes } from './Notifications.js'
import Chat, { MessagePropTypes } from './Chat.js'
import PropTypes from 'prop-types'
import React from 'react'
import Video, { StreamPropType } from './Video.js'
import _ from 'underscore'

export default class App extends React.PureComponent {
  static propTypes = {
    active: PropTypes.string,
    alerts: PropTypes.arrayOf(AlertPropType).isRequired,
    dismissAlert: PropTypes.func.isRequired,
    init: PropTypes.func.isRequired,
    notifications: PropTypes.objectOf(NotificationPropTypes).isRequired,
    notify: PropTypes.func.isRequired,
    messages: PropTypes.arrayOf(MessagePropTypes).isRequired,
    peers: PropTypes.object.isRequired,
    sendMessage: PropTypes.func.isRequired,
    streams: PropTypes.objectOf(StreamPropType).isRequired,
    toggleActive: PropTypes.func.isRequired
  }
  constructor () {
    super()
    this.state = {
      videos: {}
    }
  }
  componentDidMount () {
    const { init } = this.props
    init()
  }
  render () {
    const {
      active,
      alerts,
      dismissAlert,
      notifications,
      notify,
      messages,
      peers,
      sendMessage,
      toggleActive,
      streams
    } = this.props

    const { videos } = this.state

    return (
      <div className="app">
        <Toolbar
          chatRef={this.chatRef}
          messages={messages}
          stream={streams[constants.ME]}
          ref={node => { this.toolbarRef = node }}
        />
        <Alerts alerts={alerts} dismiss={dismissAlert} />
        <Notifications notifications={notifications} />
        <div className="chat-container" ref={node => { this.chatRef = node }}>
          <Chat
            messages={messages}
            videos={videos}
            notify={notify}
            sendMessage={sendMessage}
            toolbarRef={this.toolbarRef}
          />
        </div>
        <div className="videos">
          <Video
            videos={videos}
            active={active === constants.ME}
            onClick={toggleActive}
            stream={streams[constants.ME]}
            userId={constants.ME}
            muted
            mirrored
          />

          {_.map(peers, (_, userId) => (
            <Video
              active={userId === active}
              key={userId}
              onClick={toggleActive}
              stream={streams[userId]}
              userId={userId}
              videos={videos}
            />
          ))}
        </div>
      </div>
    )
  }
}

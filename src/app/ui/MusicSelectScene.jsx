import './MusicSelectScene.scss'

import * as MusicPreviewer from 'bemuse/music-previewer'
import $ from 'jquery'
import AuthenticationPopup from 'bemuse/online/ui/AuthenticationPopup'
import ModalPopup from 'bemuse/ui/ModalPopup'
import MusicSelectPreviewer from 'bemuse/music-previewer/MusicSelectPreviewer'
import PropTypes from 'prop-types'
import React from 'react'
import ReactDOM from 'react-dom'
import SCENE_MANAGER from 'bemuse/scene-manager'
import Scene from 'bemuse/ui/Scene'
import SceneHeading from 'bemuse/ui/SceneHeading'
import c from 'classnames'
import compose from 'recompose/compose'
import getPreviewUrl from 'bemuse/music-collection/getPreviewUrl'
import online from 'bemuse/online/instance'
import { OFFICIAL_SERVER_URL } from 'bemuse/music-collection'
import { hot } from 'react-hot-loader'
import { connect } from 'react-redux'
import { connect as connectToLegacyStore } from 'bemuse/flux'
import { createSelector, createStructuredSelector } from 'reselect'
import { shouldShowOptions } from 'bemuse/devtools/query-flags'
import { hasPendingArchiveToLoad } from '../PreloadedCustomBMS'

import * as Analytics from '../analytics'
import * as MusicSearchIO from '../io/MusicSearchIO'
import * as MusicSelectionIO from '../io/MusicSelectionIO'
import * as Options from '../entities/Options'
import * as ReduxState from '../redux/ReduxState'
import CustomBMS from './CustomBMS'
import MusicInfo from './MusicInfo'
import MusicList from './MusicList'
import OptionsView from './Options'
import RageQuitPopup from './RageQuitPopup'
import UnofficialPanel from './UnofficialPanel'
import { connectIO } from '../../impure-react/connectIO'
import Toolbar from './Toolbar'

const selectMusicSelectState = (() => {
  const selectLegacyServerObjectForCurrentCollection = createSelector(
    ReduxState.selectCurrentCollectionUrl,
    url => ({ url })
  )

  const selectIsCurrentCollectionUnofficial = createSelector(
    ReduxState.selectCurrentCollectionUrl,
    url => url !== OFFICIAL_SERVER_URL
  )

  return createStructuredSelector({
    loading: ReduxState.selectIsCurrentCollectionLoading,
    error: ReduxState.selectCurrentCorrectionLoadError,
    server: selectLegacyServerObjectForCurrentCollection,
    groups: ReduxState.selectGroups,
    song: ReduxState.selectSelectedSong,
    charts: ReduxState.selectChartsForSelectedSong,
    chart: ReduxState.selectSelectedChart,
    filterText: ReduxState.selectSearchInputText,
    highlight: ReduxState.selectSearchText,
    unofficial: selectIsCurrentCollectionUnofficial,
    playMode: ReduxState.selectPlayMode,
  })
})()

const enhance = compose(
  hot(module),
  connectToLegacyStore({ user: online && online.user??? }),
  connect(state => ({
    musicSelect: selectMusicSelectState(state),
    collectionUrl: ReduxState.selectCurrentCollectionUrl(state),
    musicPreviewEnabled: Options.isPreviewEnabled(state.options),
  })),
  connectIO({
    onSelectChart: () => (song, chart) =>
      MusicSelectionIO.selectChart(song, chart),
    onSelectSong: () => song => MusicSelectionIO.selectSong(song),
    onFilterTextChange: () => text => MusicSearchIO.handleSearchTextType(text),
    onLaunchGame: ({ musicSelect }) => () =>
      MusicSelectionIO.launchGame(
        musicSelect.server,
        musicSelect.song,
        musicSelect.chart
      ),
  })
)

class MusicSelectScene extends React.PureComponent {
  static propTypes = {
    musicSelect: PropTypes.object,
    user: PropTypes.object,
    onSelectChart: PropTypes.func,
    onSelectSong: PropTypes.func,
    onFilterTextChange: PropTypes.func,
    onLaunchGame: PropTypes.func,
    collectionUrl: PropTypes.string,
    musicPreviewEnabled: PropTypes.bool,
  }

  constructor(props) {
    super(props)
    this.state = {
      optionsVisible: shouldShowOptions(),
      customBMSVisible: hasPendingArchiveToLoad(),
      unofficialDisclaimerVisible: false,
      inSong: false,
      authenticationPopupVisible: false,
    }
  }

  getPreviewUrl() {
    const song = this.props.musicSelect.song
    return getPreviewUrl(this.props.collectionUrl, song)
  }

  render() {
    let musicSelect = this.props.musicSelect
    return (
      <Scene
        className='MusicSelectScene'
        onDragEnter={this.handleCustomBMSOpen}
      >
        <SceneHeading>
          Select Music
          <input
            type='text'
            placeholder='Filter???'
            className='MusicSelectScene???search'
            onChange={this.handleFilter}
            value={musicSelect.filterText}
          />
        </SceneHeading>

        {this.renderUnofficialDisclaimer()}

        {this.renderMain()}

        <Toolbar items={this.getToolbarItems()} />

        <ModalPopup
          visible={this.state.optionsVisible}
          onBackdropClick={this.handleOptionsClose}
        >
          <OptionsView onClose={this.handleOptionsClose} />
        </ModalPopup>

        <ModalPopup
          visible={this.state.customBMSVisible}
          onBackdropClick={this.handleCustomBMSClose}
        >
          <div className='MusicSelectScene???customBms'>
            <CustomBMS onSongLoaded={this.handleCustomSong} />
          </div>
        </ModalPopup>

        <ModalPopup
          visible={this.state.unofficialDisclaimerVisible}
          onBackdropClick={this.handleUnofficialClose}
        >
          <UnofficialPanel onClose={this.handleUnofficialClose} />
        </ModalPopup>

        <AuthenticationPopup
          visible={this.state.authenticationPopupVisible}
          onFinish={this.handleAuthenticationFinish}
          onBackdropClick={this.handleAuthenticationClose}
        />

        <RageQuitPopup />

        {!!this.props.musicPreviewEnabled && (
          <MusicSelectPreviewer url={this.getPreviewUrl()} />
        )}
      </Scene>
    )
  }

  renderUnofficialDisclaimer() {
    if (!this.props.musicSelect.unofficial) return null
    return (
      <div
        className='MusicSelectScene???unofficialLabel'
        onClick={this.handleUnofficialClick}
      >
        <b>Disclaimer:</b> Unofficial Server
      </div>
    )
  }

  renderMain() {
    const musicSelect = this.props.musicSelect
    if (musicSelect.loading) {
      return <div className='MusicSelectScene???loading'>Loading???</div>
    }
    if (musicSelect.error) {
      return (
        <div className='MusicSelectScene???loading'>Cannot load collection!</div>
      )
    }
    if (musicSelect.groups.length === 0) {
      return <div className='MusicSelectScene???loading'>No songs found!</div>
    }
    return (
      <div
        className={c('MusicSelectScene???main', {
          'is-in-song': this.state.inSong,
        })}
      >
        <MusicList
          groups={musicSelect.groups}
          highlight={musicSelect.highlight}
          selectedSong={musicSelect.song}
          selectedChart={musicSelect.chart}
          playMode={musicSelect.playMode}
          onSelect={this.handleSongSelect}
          onTouch={this.handleMusicListTouch}
        />
        <MusicInfo
          song={musicSelect.song}
          chart={musicSelect.chart}
          charts={musicSelect.charts}
          playMode={musicSelect.playMode}
          onChartClick={this.handleChartClick}
          onOptions={this.handleOptionsOpen}
        />
      </div>
    )
  }

  getToolbarItems() {
    return [
      Toolbar.item('Exit', {
        onClick: this.popScene,
      }),
      Toolbar.item('Play Custom BMS', {
        onClick: this.handleCustomBMSOpen,
      }),
      Toolbar.spacer(),
      ...this.getOnlineToolbarButtons(),
      Toolbar.item('Options', {
        onClick: this.handleOptionsOpen,
      }),
    ]
  }
  getOnlineToolbarButtons() {
    if (!online) return []
    if (this.props.user) {
      return [
        Toolbar.item(<span>Log Out ({this.props.user.username})</span>, {
          onClick: this.handleLogout,
        }),
      ]
    } else {
      return [
        Toolbar.item('Log In / Create an Account', {
          onClick: this.handleAuthenticate,
        }),
      ]
    }
  }
  componentDidMount() {
    this.ensureSelectedSongInView()
  }
  ensureSelectedSongInView() {
    const $this = $(ReactDOM.findDOMNode(this))
    const active = $this.find('.js-active-song')[0]
    if (!active) return
    const scroller = $(active).closest('.js-scrollable-view')[0]
    if (!scroller) return
    const scrollerRect = scroller.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    if (
      activeRect.bottom > scrollerRect.bottom ||
      activeRect.top < scrollerRect.top
    ) {
      scroller.scrollTop +=
        activeRect.top +
        activeRect.height / 2 -
        (scrollerRect.top + scrollerRect.height / 2)
    }
  }
  handleSongSelect = (song, chart) => {
    if (chart) {
      this.props.onSelectChart(song, chart)
      Analytics.send('MusicSelectScene', 'select', 'song and chart')
    } else {
      this.props.onSelectSong(song)
      Analytics.send('MusicSelectScene', 'select', 'song')
    }
    this.setState({ inSong: true })
  }
  handleMusicListTouch = () => {
    this.setState({ inSong: false })
  }
  handleChartClick = chart => {
    if (this.props.musicSelect.chart.md5 === chart.md5) {
      Analytics.send('MusicSelectScene', 'launch game')
      MusicPreviewer.go()
      this.props.onLaunchGame()
    } else {
      Analytics.send('MusicSelectScene', 'select chart')
      this.props.onSelectChart(this.props.musicSelect.song, chart)
    }
  }
  handleFilter = e => {
    this.props.onFilterTextChange(e.target.value)
  }
  handleOptionsOpen = () => {
    Analytics.send('MusicSelectScene', 'open options')
    this.setState({ optionsVisible: true })
  }
  handleOptionsClose = () => {
    this.setState({ optionsVisible: false })
  }
  handleCustomBMSOpen = () => {
    this.setState({ customBMSVisible: true })
    Analytics.send('MusicSelectScene', 'open custom BMS')
  }
  handleCustomBMSClose = () => {
    this.setState({ customBMSVisible: false })
  }
  handleCustomSong = song => {
    this.setState({ customBMSVisible: false })
  }
  handleUnofficialClick = () => {
    this.setState({ unofficialDisclaimerVisible: true })
    Analytics.send('MusicSelectScene', 'view unofficial disclaimer')
  }
  handleUnofficialClose = () => {
    this.setState({ unofficialDisclaimerVisible: false })
  }
  handleLogout = () => {
    if (confirm('Do you really want to log out?')) {
      Promise.resolve(online.logOut()).done()
      Analytics.send('MusicSelectScene', 'logout')
    }
  }
  handleAuthenticate = () => {
    this.setState({ authenticationPopupVisible: true })
    Analytics.send('MusicSelectScene', 'authenticate')
  }
  handleAuthenticationClose = () => {
    this.setState({ authenticationPopupVisible: false })
  }
  handleAuthenticationFinish = () => {
    this.setState({ authenticationPopupVisible: false })
  }
  popScene() {
    SCENE_MANAGER.pop().done()
  }
}

export default enhance(MusicSelectScene)

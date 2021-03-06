import { createStore, Store } from 'redux'
import reducer from './reducers'
import dragDropActions from './actions/dragDrop'
import DragDropMonitorImpl from './DragDropMonitorImpl'
import HandlerRegistryImpl from './HandlerRegistryImpl'
import {
	ActionCreator,
	Backend,
	BackendFactory,
	DragDropActions,
	DragDropMonitor,
	DragDropManager,
	HandlerRegistry,
} from './interfaces'
import { State } from './reducers'

function makeStoreInstance(debugMode: boolean) {
	// TODO: if we ever make a react-native version of this,
	// we'll need to consider how to pull off dev-tooling
	const reduxDevTools =
		typeof window !== 'undefined' &&
		(window as any).__REDUX_DEVTOOLS_EXTENSION__
	return createStore(
		reducer,
		debugMode &&
			reduxDevTools &&
			reduxDevTools({
				name: 'dnd-core',
				instanceId: 'dnd-core',
			}),
	)
}

export default class DragDropManagerImpl<Context>
	implements DragDropManager<Context> {
	private store: Store<State>
	private monitor: DragDropMonitor
	private backend: Backend
	private isSetUp: boolean = false

	constructor(
		createBackend: BackendFactory,
		private context: Context = {} as Context,
		debugMode = false,
	) {
		const store = makeStoreInstance(debugMode)
		this.store = store
		this.monitor = new DragDropMonitorImpl(
			store,
			new HandlerRegistryImpl(store),
		)
		this.backend = createBackend(this)

		store.subscribe(this.handleRefCountChange)
	}

	public getContext() {
		return this.context
	}

	public getMonitor(): DragDropMonitor {
		return this.monitor
	}

	public getBackend() {
		return this.backend
	}

	public getRegistry(): HandlerRegistry {
		return (this.monitor as DragDropMonitorImpl).registry
	}

	public getActions(): DragDropActions {
		const manager = this
		const { dispatch } = this.store

		function bindActionCreator(actionCreator: ActionCreator<any>) {
			return (...args: any[]) => {
				const action = actionCreator.apply(manager, args)
				if (typeof action !== 'undefined') {
					dispatch(action)
				}
			}
		}

		const actions = dragDropActions(this)

		return Object.keys(actions).reduce(
			(boundActions: DragDropActions, key: string) => {
				const action: ActionCreator<any> = (actions as any)[
					key
				] as ActionCreator<any>
				;(boundActions as any)[key] = bindActionCreator(action)
				return boundActions
			},
			{} as DragDropActions,
		)
	}

	public dispatch(action: any) {
		this.store.dispatch(action)
	}

	private handleRefCountChange = () => {
		const shouldSetUp = this.store.getState().refCount > 0
		if (shouldSetUp && !this.isSetUp) {
			this.backend.setup()
			this.isSetUp = true
		} else if (!shouldSetUp && this.isSetUp) {
			this.backend.teardown()
			this.isSetUp = false
		}
	}
}

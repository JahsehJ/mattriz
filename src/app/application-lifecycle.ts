export interface Disposable {
	dispose(): void;
}

/**
 * Owns browser listeners and disposable application resources. Disposal is
 * idempotent so page lifecycle events cannot release a resource twice.
 */
export class ApplicationLifecycle {
	private readonly cleanups: Array<() => void> = [];
	private disposed = false;

	listen<TEvent extends Event>(
		target: EventTarget,
		type: string,
		listener: (event: TEvent) => void,
		options?: AddEventListenerOptions | boolean,
	): void {
		if (this.disposed) throw new Error("Application lifecycle is disposed");
		const eventListener = listener as EventListener;
		target.addEventListener(type, eventListener, options);
		this.cleanups.push(() =>
			target.removeEventListener(type, eventListener, options),
		);
	}

	own(resource: Disposable): void {
		if (this.disposed) {
			resource.dispose();
			return;
		}
		this.cleanups.push(() => resource.dispose());
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
	}
}

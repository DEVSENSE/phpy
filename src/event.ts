export class EventEmitter<T> implements Event<T> {

    private listeners: ((e: T) => any)[] = []

    on(listener: (e: T) => any): Disposable {
        
        this.listeners.push(listener)

        return {
            [Symbol.dispose]: () => {
                const index = this.listeners.indexOf(listener)
                if (index >= 0) {
                    this.listeners.splice(index, 1)
                }
            }
        }

    }

    public fire(e: T) {
        for (const listener of this.listeners) {
            try {
                listener(e)
            } catch (e) {
                console.error(e)
            }
        }
    }
}

export interface Event<T> {
    on(listener: (e: T) => any): Disposable
}
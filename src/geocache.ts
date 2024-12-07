// geocache.ts
export interface Coin {
    i: number;
    j: number;
    number: number; // Unique identifier within a cache
}

export interface Geocache {
    i: number;
    j: number;
    coins: Coin[];
    toMemento(): string; // Serialize the state
    fromMemento(memento: string): void; // Restore the state
}

export function createGeocache(i: number, j: number, coins: Coin[] = []): Geocache {
    return {
        i,
        j,
        coins,
        toMemento(): string {
            return JSON.stringify({ i: this.i, j: this.j, coins: this.coins });
        },
        fromMemento(memento: string): void {
            const state = JSON.parse(memento);
            this.i = state.i;
            this.j = state.j;
            this.coins = state.coins;
        },
    };
}
import leaflet from "leaflet";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;
  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = `${i},${j}`;
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat / this.tileWidth);
    const j = Math.floor(point.lng / this.tileWidth);
    return this.getCanonicalCell({ i, j });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const southWest = leaflet.latLng(
      cell.i * this.tileWidth,
      cell.j * this.tileWidth,
    );
    const northEast = leaflet.latLng(
      (cell.i + 1) * this.tileWidth,
      (cell.j + 1) * this.tileWidth,
    );
    return leaflet.latLngBounds(southWest, northEast);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    for (
      let di = -this.tileVisibilityRadius;
      di <= this.tileVisibilityRadius;
      di++
    ) {
      for (
        let dj = -this.tileVisibilityRadius;
        dj <= this.tileVisibilityRadius;
        dj++
      ) {
        resultCells.push(
          this.getCanonicalCell({
            i: originCell.i + di,
            j: originCell.j + dj,
          }),
        );
      }
    }
    return resultCells;
  }
}

import "./mock-data";

declare module "./mock-data" {
  interface Venda {
    concluidoEm?: string;
    concluidoPor?: string;
  }
}

export {};

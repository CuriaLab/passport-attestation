import {
  BarretenbergBackend,
  BarretenbergVerifier as Verifier,
} from "@noir-lang/backend_barretenberg"
import { Noir } from "@noir-lang/noir_js"

import circuit from "../../public/circuits.json"

export const prove = async () => {
  const backend = new BarretenbergBackend(circuit)
  const noir = new Noir(circuit, backend)
}

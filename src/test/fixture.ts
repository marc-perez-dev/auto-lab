// Builds synthetic RheoML files shaped like the ones TRIOS exports.

export interface FixturePoint {
  frequency: number
  storage: number
  loss: number
  strain?: number
}

/** The 20 frequencies (Hz) the instrument steps through in a frequency sweep. */
export const SWEEP_FREQUENCIES = [
  0.1, 0.125892, 0.158489, 0.199525, 0.25119, 0.316225, 0.398109, 0.501187, 0.630956, 0.794337, 1, 1.25891,
  1.58488, 1.99528, 2.51191, 3.16224, 3.98106, 5.01187, 6.30951, 7,
]

/** Amplitude sweep: every row at 1 Hz with growing strain. */
export function amplitudeSweep(points = 16): FixturePoint[] {
  return Array.from({ length: points }, (_, i) => ({
    frequency: 1,
    strain: 0.01 * 10 ** (i / 5),
    storage: 1000 - i,
    loss: 50 + i,
  }))
}

export function frequencySweep(base: number, frequencies = SWEEP_FREQUENCIES): FixturePoint[] {
  return frequencies.map((frequency, i) => ({ frequency, strain: 1, storage: base + i, loss: base / 10 + i }))
}

export interface FixtureOptions {
  sample: string
  file: string
  folder?: string
  date?: string
  time?: string
  rawDataFile?: string | null
  segments: FixturePoint[][]
}

export function rheomlXml({
  sample,
  file,
  folder = '2026-01-15 Prueba D1 N1',
  date = '2026-01-15',
  time = '10:00:00',
  rawDataFile,
  segments,
}: FixtureOptions): string {
  const raw = rawDataFile === undefined ? `C:\\Users\\lab\\Desktop\\${folder}\\${file}.tri` : rawDataFile
  let t = 0
  const segmentXml = segments
    .map(
      (points, s) =>
        `<ExperimentalData DataType="Dynamic Mechanical Analysis" SegmentNumber="${s + 1}">` +
        points
          .map((p) => {
            t += 6.5
            return (
              `<DMA><Time unit="s">${t}</Time><SegmentTime unit="s">${t}</SegmentTime>` +
              `<Temperature unit="°C">37.0</Temperature><Frequency unit="Hz">${p.frequency.toFixed(6)}</Frequency>` +
              `<StorageModulus unit="Pa">${p.storage}</StorageModulus><LossModulus unit="Pa">${p.loss}</LossModulus>` +
              `<StressAmpl unit="Pa">1.5</StressAmpl><StrainAmpl unit="%">${p.strain ?? 1}</StrainAmpl>` +
              `<LossFactor unit="-">5.0e-3</LossFactor><AngDisplAmpl unit="rad">8.0e-5</AngDisplAmpl>` +
              `<TorqueAmpl unit="µN.m">0.025</TorqueAmpl><ComplexViscosity unit="Pa.s">1850.5</ComplexViscosity></DMA>`
            )
          })
          .join('') +
        `</ExperimentalData>`,
    )
    .join('')

  return (
    `\uFEFF<?xml version="1.0" encoding="utf-8"?><?xml-stylesheet type="text/xsl" href="RheoML2html.xsl"?>` +
    `<RheoML_Dataset xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="RheoML.xsd">` +
    `<Source><Organization>LAB</Organization><Date>${date}</Date><Time>${time}</Time><Operator>OP</Operator>` +
    (raw === null ? '' : `<RawDataFile>${raw}</RawDataFile>`) +
    `</Source><Sample><SampleName>${sample}</SampleName><SampleHistory /><Comment>\r\n</Comment></Sample>` +
    `<Equipment><EquipmentName>1234-5678</EquipmentName><MeasurementAtmosphere /><Comment />` +
    `<DMA_RVM><DeformationType>Rotation/Torsion</DeformationType><DMAModulusType>G*</DMAModulusType>` +
    `<ParallelPlate><Radius unit="mm">4</Radius><Gap unit="µm">1000</Gap></ParallelPlate></DMA_RVM></Equipment>` +
    segmentXml +
    `</RheoML_Dataset>`
  )
}

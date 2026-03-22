'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'paper-alpha:position-notes'

export interface PositionNote {
  target: number | null
  thesis: string
}

type NotesMap = Record<string, PositionNote>

function readFromStorage(): NotesMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as NotesMap) : {}
  } catch {
    return {}
  }
}

function writeToStorage(notes: NotesMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    // storage quota exceeded or unavailable
  }
}

export function usePositionNotes() {
  const [notes, setNotes] = useState<NotesMap>({})

  useEffect(() => {
    setNotes(readFromStorage())
  }, [])

  const getNote = useCallback(
    (symbol: string): PositionNote => {
      return notes[symbol] ?? { target: null, thesis: '' }
    },
    [notes]
  )

  const saveNote = useCallback(
    (symbol: string, note: PositionNote) => {
      setNotes((prev) => {
        const next = { ...prev, [symbol]: note }
        writeToStorage(next)
        return next
      })
    },
    []
  )

  return { notes, getNote, saveNote }
}

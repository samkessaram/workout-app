// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../lib/db'
import { newExercise, saveExercise } from '../lib/exercises'
import { entryFor, listRoutines, saveRoutine } from '../lib/routines'
import Routines from './Routines.svelte'

afterEach(async () => {
  cleanup()
  await db.delete()
  await db.open()
})

const names = async () => (await listRoutines()).map((r) => r.name)

describe('Routines screen', () => {
  it('lists only the Routines that exist, with no type preselected', async () => {
    render(Routines)
    await screen.findByText('No Routines yet.')
    await saveRoutine({ sessionType: 'upper', name: 'Upper B', entries: [] })
    await saveRoutine({ sessionType: 'lower', name: 'Lower A', entries: [] })
    await screen.findByRole('button', { name: /Lower A/ })
    const rows = screen.getAllByRole('button').filter((b) => /Upper B|Lower A/.test(b.textContent ?? ''))
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('Upper B'), expect.stringContaining('Lower A')])
    expect(screen.queryByRole('button', { name: 'lower' })).toBeNull()
  })

  it('creates Routines by choosing a name and a Session type, then renames and deletes one', async () => {
    render(Routines)
    await fireEvent.click(await screen.findByRole('button', { name: '+ New Routine' }))
    const create = screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    await fireEvent.input(screen.getByLabelText('Routine name'), { target: { value: 'Lower A' } })
    expect(create.disabled).toBe(true) // still needs a type
    await fireEvent.click(screen.getByRole('button', { name: 'lower' }))
    await fireEvent.click(create)
    await waitFor(async () => expect(await names()).toEqual(['Lower A']))
    expect((await listRoutines())[0].sessionType).toBe('lower')

    await fireEvent.change(await screen.findByDisplayValue('Lower A'), { target: { value: 'Legs' } })
    await waitFor(async () => expect(await names()).toEqual(['Legs']))

    await fireEvent.click(screen.getByRole('button', { name: 'Delete Routine' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await waitFor(async () => expect(await names()).toEqual([]))
    await screen.findByText('No Routines yet.')
  })

  it('removes an Exercise from a Routine straight from its row', async () => {
    const a = await saveExercise({ ...newExercise('lb'), name: 'Squat' })
    const b = await saveExercise({ ...newExercise('lb'), name: 'Lunge' })
    await saveRoutine({ sessionType: 'lower', name: 'Lower A', entries: [a, b].map((id) => entryFor({ ...newExercise('lb'), id })) })
    render(Routines)
    await fireEvent.click(await screen.findByRole('button', { name: /Lower A/ }))
    await fireEvent.click(await screen.findByRole('button', { name: 'Remove Squat (barbell)' }))
    await waitFor(async () => expect((await listRoutines())[0].entries.map((e) => e.exerciseId)).toEqual([b]))
  })
})

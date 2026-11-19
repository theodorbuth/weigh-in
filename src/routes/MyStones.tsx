import { LockKeyhole, Plus } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import CategoryDialog, { type CategoryDraft } from '../components/CategoryDialog'
import CategoryPit from '../components/CategoryPit'
import StoneEditor, { type StoneDraft } from '../components/StoneEditor'
import { nextFreeColour } from '../lib/colours'
import { formatHours } from '../lib/format'
import { fitUnit, PIT_FLOOR } from '../lib/pitLayout'
import type { Category, StoneRow } from '../lib/project'
import { useProjectContext } from '../lib/projectContext'
import { supabase } from '../lib/supabase'
import styles from './MyStones.module.css'

type CategoryEdit = { mode: 'new' } | { mode: 'edit'; category: Category } | null
const OTHER = 'other'

/**
 * My stones (Figma "My stones"): your private pits. Stones here are DRAFTS
 * (round_id is null) until you seal them during a check-in; nobody else can read them.
 * Requirement 6: every add/edit/remove is a row in `stones`; reload shows the same pits.
 */
export default function MyStones() {
  const { data, reload, me } = useProjectContext()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [categoryEdit, setCategoryEdit] = useState<CategoryEdit>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const pitRefs = useRef(new Map<string, HTMLDivElement>())
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null)

  const myStones = data.stones.filter((s) => s.user_id === me && s.round_id === null)
  const byCategory = (id: number | null) => myStones.filter((s) => s.category_id === id)
  const categories = data.categories
  const selected = myStones.find((s) => s.id === selectedId) ?? null
  const selectedCategory = selected ? categories.find((c) => c.id === selected.category_id) : undefined
  const total = myStones.reduce((sum, s) => sum + (s.hours ?? 0), 0)

  // One stone scale for all pits so sizes compare honestly (area ∝ hours).
  const unit = fitUnit(
    [...categories.map((c) => byCategory(c.id)), byCategory(null)].map((st) => st.map((s) => ({ id: s.id, hours: s.hours ?? 1 }))),
    { width: PIT_FLOOR.width, height: PIT_FLOOR.height, max: 92, min: 16 },
  )

  // Place the editor beside the pit that holds the selected stone.
  useLayoutEffect(() => {
    if (!selected || !workspace.current) return setPopoverPos(null)
    const key = selected.category_id == null ? OTHER : String(selected.category_id)
    const pit = pitRefs.current.get(key)
    if (!pit) return
    const box = workspace.current.getBoundingClientRect()
    const r = pit.getBoundingClientRect()
    const width = 330
    const right = r.right - box.left + 16
    const left = right + width <= box.width ? right : Math.max(0, r.left - box.left - width - 16)
    setPopoverPos({ left: key === OTHER ? box.width - width : left, top: key === OTHER ? r.top - box.top - 330 : r.top - box.top })
  }, [selected, categories.length])

  /** Runs one Supabase write, shows its error if any, refreshes, and says whether it worked. */
  async function run<T>(
    action: () => PromiseLike<{ data: T; error: { message: string } | null }>,
  ): Promise<{ ok: boolean; data: T | null }> {
    setSaving(true)
    setError(null)
    const { data: result, error } = await action()
    setSaving(false)
    if (error) {
      setError(error.message)
      return { ok: false, data: null }
    }
    await reload()
    return { ok: true, data: result }
  }

  async function addStone(categoryId: number | null) {
    const { ok, data: row } = await run(() =>
      supabase
        .from('stones')
        .insert({ project_id: data.project.id, user_id: me, category_id: categoryId, hours: 1 })
        .select('id')
        .single(),
    )
    if (ok && row) setSelectedId((row as { id: number }).id)
  }

  async function saveStone(stone: StoneRow, draft: StoneDraft) {
    const { ok } = await run(() =>
      supabase
        .from('stones')
        .update({ hours: draft.hours, note: draft.note || null, link: draft.link || null })
        .eq('id', stone.id),
    )
    if (ok) setSelectedId(null)
  }

  async function removeStone(stone: StoneRow) {
    const { ok } = await run(() => supabase.from('stones').delete().eq('id', stone.id))
    if (ok) setSelectedId(null)
  }

  async function saveCategory(draft: CategoryDraft) {
    if (!categoryEdit) return
    const { ok } =
      categoryEdit.mode === 'new'
        ? await run(() =>
            supabase.from('categories').insert({
              project_id: data.project.id,
              name: draft.name,
              colour: draft.colour,
              sort_order: Math.max(-1, ...categories.map((c) => c.sort_order)) + 1,
              created_by: me,
            }),
          )
        : await run(() => supabase.from('categories').update({ name: draft.name, colour: draft.colour }).eq('id', categoryEdit.category.id))
    if (ok) setCategoryEdit(null)
  }

  async function deleteCategory(category: Category) {
    const { ok } = await run(() => supabase.from('categories').delete().eq('id', category.id))
    if (ok) setCategoryEdit(null)
  }

  const pitRef = (key: string) => (el: HTMLDivElement | null) => {
    if (el) pitRefs.current.set(key, el)
    else pitRefs.current.delete(key)
  }

  return (
    <div className={styles.workspace} ref={workspace}>
      <div className={styles.grid}>
        {categories.map((c) => (
          <div key={c.id} ref={pitRef(String(c.id))}>
            <CategoryPit
              title={c.name}
              colour={c.colour}
              stones={byCategory(c.id)}
              unit={unit}
              selectedId={selectedId}
              isPrivate={c.shared_at === null}
              readOnly={saving}
              onAdd={() => addStone(c.id)}
              onSelect={(s) => setSelectedId(s.id)}
              onEditCategory={() => setCategoryEdit({ mode: 'edit', category: c })}
            />
          </div>
        ))}
        <button type="button" className={styles.newTile} onClick={() => setCategoryEdit({ mode: 'new' })}>
          <span>
            <Plus size={20} strokeWidth={1.7} aria-hidden />
          </span>
          New category
        </button>
      </div>

      <div className={styles.otherRow} ref={pitRef(OTHER)}>
        <CategoryPit
          title="Other work"
          stones={byCategory(null)}
          unit={Math.min(unit, 80)}
          selectedId={selectedId}
          readOnly={saving}
          onAdd={() => addStone(null)}
          onSelect={(s) => setSelectedId(s.id)}
        />
      </div>

      <div className={styles.sealRow}>
        {error ? (
          <p className={styles.error} role="alert">
            Couldn’t save: {error}
          </p>
        ) : (
          <p className={styles.message}>Only you can see these stones. Sealing opens when a check-in starts.</p>
        )}
        <div className={styles.total}>
          <span>Your total</span>
          <strong>{formatHours(total)}</strong>
        </div>
        <button type="button" className={styles.seal} disabled title="Opens when a check-in starts">
          Submit and seal
          <LockKeyhole size={18} strokeWidth={1.7} aria-hidden />
        </button>
      </div>

      {selected && popoverPos && (
        <div className={styles.popover} style={popoverPos}>
          <StoneEditor
            key={selected.id}
            title={`${selectedCategory?.name ?? 'Other work'} stone`}
            seed={selected.id}
            colour={selectedCategory?.colour}
            variant={selectedCategory ? 'color' : 'other'}
            initial={{ hours: selected.hours ?? 1, note: selected.note ?? '', link: selected.link ?? '' }}
            saving={saving}
            onSave={(d) => saveStone(selected, d)}
            onRemove={() => removeStone(selected)}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}

      {categoryEdit && (
        <CategoryDialog
          mode={categoryEdit.mode}
          initial={
            categoryEdit.mode === 'new'
              ? { name: '', colour: nextFreeColour(categories.map((c) => c.colour)) }
              : { name: categoryEdit.category.name, colour: categoryEdit.category.colour }
          }
          takenNames={categories.filter((c) => categoryEdit.mode === 'new' || c.id !== categoryEdit.category.id).map((c) => c.name)}
          onClose={() => setCategoryEdit(null)}
          onSave={saveCategory}
          onRemove={
            categoryEdit.mode === 'edit' && categoryEdit.category.shared_at === null && categoryEdit.category.created_by === me
              ? () => deleteCategory(categoryEdit.category)
              : undefined
          }
        />
      )}
    </div>
  )
}

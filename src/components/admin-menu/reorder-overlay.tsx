import type { Dispatch, SetStateAction } from "react";
import { setReorderDragGhost } from "@/components/admin-menu/helpers";
import type { AdminMenuItem } from "@/components/admin-menu/types";

type MenuReorderOverlayProps = {
  activeCategory: string;
  busy: boolean;
  draggingReorderItemId: string | null;
  moveItemByStep: (itemId: string, step: 1 | -1) => Promise<void>;
  reorderCategoryItems: (movingId: string, targetId: string) => Promise<void>;
  reorderDropTargetId: string | null;
  setDraggingReorderItemId: Dispatch<SetStateAction<string | null>>;
  setReorderDropTargetId: Dispatch<SetStateAction<string | null>>;
  setShowReorderMode: Dispatch<SetStateAction<boolean>>;
  visibleItems: AdminMenuItem[];
};

/** Modalità riordino dei piatti a schermo intero. */
export function MenuReorderOverlay({
  activeCategory,
  busy,
  draggingReorderItemId,
  moveItemByStep,
  reorderCategoryItems,
  reorderDropTargetId,
  setDraggingReorderItemId,
  setReorderDropTargetId,
  setShowReorderMode,
  visibleItems,
}: MenuReorderOverlayProps) {
  return (
    <div
      className="admin-modal-backdrop reorder-backdrop"
      role="presentation"
    >
      <div
        className="admin-modal reorder-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Riordina piatti"
      >
        <div className="reorder-header-wrap">
          <div className="admin-modal-head reorder-head">
            <h3>Riordina piatti</h3>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setShowReorderMode(false);
                setReorderDropTargetId(null);
                setDraggingReorderItemId(null);
              }}
              aria-label="Chiudi modalita riordino"
            >
              ×
            </button>
          </div>

          <p className="section-subtitle reorder-subtitle">
            Categoria: {activeCategory || "Nessuna"}
          </p>
        </div>

        <div
          className="reorder-list"
          role="list"
          aria-label="Ordine piatti"
        >
          {visibleItems.map((item, index) => {
            const isDragging = draggingReorderItemId === item.id;
            const isDropTarget =
              reorderDropTargetId === item.id && !isDragging;
            const isFirst = index === 0;
            const isLast = index === visibleItems.length - 1;

            return (
              <article
                key={`reorder-${item.id}`}
                className={
                  isDragging
                    ? "reorder-row is-dragging"
                    : isDropTarget
                      ? "reorder-row is-drop-target"
                      : "reorder-row"
                }
                role="listitem"
                onDragEnter={() => {
                  setReorderDropTargetId(item.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setReorderDropTargetId(item.id);
                }}
                onDrop={() => {
                  if (!draggingReorderItemId) return;
                  void reorderCategoryItems(draggingReorderItemId, item.id);
                  setDraggingReorderItemId(null);
                  setReorderDropTargetId(null);
                }}
                onDragEnd={() => {
                  setDraggingReorderItemId(null);
                  setReorderDropTargetId(null);
                }}
              >
                <div className="reorder-name-box">
                  <span className="reorder-title">{item.nome}</span>
                </div>
                <div
                  className="reorder-actions"
                  aria-label="Azioni riordino"
                >
                  <button
                    type="button"
                    className="reorder-shift-btn"
                    disabled={isFirst || busy}
                    onClick={() => {
                      void moveItemByStep(item.id, -1);
                    }}
                    aria-label={`Sposta su ${item.nome}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="reorder-shift-btn"
                    disabled={isLast || busy}
                    onClick={() => {
                      void moveItemByStep(item.id, 1);
                    }}
                    aria-label={`Sposta giu ${item.nome}`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="reorder-drag-handle"
                    draggable
                    onDragStart={(event) => {
                      setReorderDragGhost(event, item.nome);
                      setDraggingReorderItemId(item.id);
                      setReorderDropTargetId(item.id);
                    }}
                    onDragEnd={() => {
                      setDraggingReorderItemId(null);
                      setReorderDropTargetId(null);
                    }}
                    aria-label={`Trascina ${item.nome}`}
                    title="Trascina da qui per riordinare"
                  >
                    ⋮⋮
                  </button>
                </div>
                {isDropTarget ? (
                  <span className="reorder-slot-placeholder" aria-hidden />
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="admin-menu-toolbar minimal-right reorder-footer-bar">
          <button
            type="button"
            className="btn-success"
            onClick={() => {
              setShowReorderMode(false);
              setReorderDropTargetId(null);
              setDraggingReorderItemId(null);
            }}
          >
            Fine
          </button>
        </div>
      </div>
    </div>
  );
}

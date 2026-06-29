import { BookOpen, FileText, Route, ShieldQuestion } from "lucide-react";
import type { KnowledgeBrowser } from "../lib/workbenchTypes";

interface KnowledgeBrowserPanelProps {
  knowledge: KnowledgeBrowser;
}

export function KnowledgeBrowserPanel({ knowledge }: KnowledgeBrowserPanelProps) {
  const dossier = knowledge.setupDossiers[0];
  const caseCard = knowledge.caseCards[0];
  const playbook = knowledge.reasoningPlaybooks[0];

  return (
    <section className="knowledge-browser" aria-label="Brooks knowledge browser">
      <div className="panel-heading">
        <BookOpen size={16} />
        Knowledge browser
      </div>
      <div className="knowledge-layout">
        <div className="concept-index" aria-label="Concept graph">
          {knowledge.concepts.slice(0, 6).map((concept) => (
            <article key={concept.key} className="concept-chip">
              <strong>{concept.name}</strong>
              <span>{concept.summary}</span>
              <em>{concept.sourceRefs.join(" / ")}</em>
            </article>
          ))}
        </div>

        <div className="knowledge-detail">
          {dossier ? (
            <section className="dossier-panel">
              <div className="knowledge-subhead">
                <Route size={14} />
                Setup dossier
              </div>
              <h2>{dossier.name}</h2>
              <p>{dossier.context}</p>
              <div className="knowledge-columns">
                <ListBlock title="Measurements" items={dossier.measurements} />
                <ListBlock title="Failure modes" items={dossier.failureModes} />
                <ListBlock title="Management" items={dossier.management} />
              </div>
            </section>
          ) : null}

          <div className="knowledge-grid">
            {caseCard ? (
              <section className="knowledge-card">
                <div className="knowledge-subhead">
                  <FileText size={14} />
                  Case cards
                </div>
                <h2>{caseCard.title}</h2>
                <p>{caseCard.patternInterpretation}</p>
                <strong>{caseCard.expectedFollowThrough}</strong>
                <span>{caseCard.failureScenario}</span>
              </section>
            ) : null}

            {playbook ? (
              <section className="knowledge-card">
                <div className="knowledge-subhead">
                  <ShieldQuestion size={14} />
                  Reasoning playbooks
                </div>
                <h2>{playbook.name}</h2>
                <ul>
                  {playbook.questions.slice(0, 4).map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
                <span>{playbook.displayGuardrails[0]}</span>
              </section>
            ) : null}

            <section className="knowledge-card source-map">
              <div className="knowledge-subhead">Source mapping</div>
              {knowledge.sources.map((source) => (
                <div key={source.id}>
                  <strong>{source.title}</strong>
                  <span>{source.chapterRefs.join(" | ")}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

interface ListBlockProps {
  title: string;
  items: string[];
}

function ListBlock({ title, items }: ListBlockProps) {
  return (
    <div className="knowledge-list-block">
      <strong>{title}</strong>
      <ul>
        {items.slice(0, 3).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

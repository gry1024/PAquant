import { BookOpen, FileText, Route, ShieldQuestion } from "lucide-react";
import type { CaseCard, KnowledgeBrowser } from "../lib/workbenchTypes";

interface KnowledgeBrowserPanelProps {
  knowledge: KnowledgeBrowser;
}

export function KnowledgeBrowserPanel({ knowledge }: KnowledgeBrowserPanelProps) {
  const dossier = knowledge.setupDossiers[0];
  const caseCard = knowledge.caseCards[0];
  const playbook = knowledge.reasoningPlaybooks[0];
  const conceptNames = new Map(knowledge.concepts.map((concept) => [concept.key, concept.name]));

  return (
    <section className="knowledge-browser" aria-label="Brooks 知识浏览器">
      <div className="panel-heading">
        <BookOpen size={16} />
        阿尔布鲁克斯价格行为学知识库
      </div>
      <div className="knowledge-layout">
        <div className="concept-index" aria-label="价格行为概念图谱">
          <h2>教材目录</h2>
          {knowledge.chapterMap.map((chapter) => (
            <article key={`${chapter.sourceId}-${chapter.title}`} className="concept-chip chapter-chip">
              <strong>{chapter.part} / {chapter.title}</strong>
              <span>{chapter.summary}</span>
              <em>{chapter.conceptKeys.map((key) => conceptNames.get(key) ?? key).join(" · ")}</em>
            </article>
          ))}

          <h2>知识图谱</h2>
          {knowledge.concepts.slice(0, 10).map((concept) => (
            <article key={concept.key} className="concept-chip">
              <strong>{concept.name}</strong>
              <span>{concept.summary}</span>
              <em>{concept.sourceRefs.join(" / ")}</em>
            </article>
          ))}
          <div className="concept-edge-list" aria-label="概念关系">
            {knowledge.conceptEdges.slice(0, 8).map((edge) => (
              <span key={`${edge.source}-${edge.target}`}>
                {conceptNames.get(edge.source) ?? edge.source} → {conceptNames.get(edge.target) ?? edge.target}
                <em>{edge.relation}</em>
              </span>
            ))}
          </div>
        </div>

        <div className="knowledge-detail">
          {dossier ? (
            <section className="dossier-panel">
              <div className="knowledge-subhead">
                <Route size={14} />
                形态档案
              </div>
              <h2>{dossier.name}</h2>
              <p>{dossier.context}</p>
              <div className="knowledge-columns">
                <ListBlock title="观察条件" items={dossier.observations} />
                <ListBlock title="测量依据" items={dossier.measurements} />
                <ListBlock title="入场方式" items={dossier.entryStyles} />
                <ListBlock title="止损逻辑" items={dossier.stopLogic} />
                <ListBlock title="目标" items={dossier.targets} />
                <ListBlock title="失败模式" items={dossier.failureModes} />
                <ListBlock title="持仓管理" items={dossier.management} />
              </div>
            </section>
          ) : null}

          <section className="knowledge-card glossary-card" aria-label="术语表">
            <div className="knowledge-subhead">术语表</div>
            <div className="glossary-grid">
              {knowledge.glossary.map((term) => (
                <article key={term.english}>
                  <strong>{term.chinese}</strong>
                  <code>{term.abbreviation ? `${term.english} / ${term.abbreviation}` : term.english}</code>
                  <span>{term.definition}</span>
                </article>
              ))}
            </div>
          </section>

          <div className="knowledge-grid">
            {caseCard ? (
              <section className="knowledge-card">
                <div className="knowledge-subhead">
                  <FileText size={14} />
                  图文案例
                </div>
                <h2>{caseCard.title}</h2>
                <CasePatternDiagram caseCard={caseCard} />
                <p>{caseCard.patternInterpretation}</p>
                <strong>{caseCard.expectedFollowThrough}</strong>
                <span>{caseCard.failureScenario}</span>
              </section>
            ) : null}

            {playbook ? (
              <section className="knowledge-card">
                <div className="knowledge-subhead">
                  <ShieldQuestion size={14} />
                  推理手册
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
              <div className="knowledge-subhead">书籍来源映射</div>
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

function CasePatternDiagram({ caseCard }: { caseCard: CaseCard }) {
  const points = caseCard.diagram.points;
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <figure className={`case-diagram ${caseCard.diagram.kind}`} aria-label="形态图解">
      <svg viewBox="0 0 100 78" role="img" aria-label={caseCard.diagram.caption}>
        {caseCard.diagram.levels.map((level) => (
          <g key={level.label} className="case-diagram-level">
            <line x1={6} y1={level.y} x2={94} y2={level.y} />
            <text x={7} y={Math.max(8, level.y - 2)}>
              {level.label}
            </text>
          </g>
        ))}
        <polyline className="case-diagram-path" points={path} />
        {points.map((point) => (
          <g
            key={`${point.label}-${point.x}-${point.y}`}
            className={`case-diagram-point ${point.role}`}
          >
            <circle cx={point.x} cy={point.y} r={2.4} />
            <text x={point.x + 2.8} y={Math.max(6, point.y - 2.8)}>
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>{caseCard.diagram.caption}</figcaption>
    </figure>
  );
}

import { BookOpen, FileText, Route, ShieldQuestion } from "lucide-react";
import type { CaseCard, KnowledgeBrowser } from "../lib/workbenchTypes";

interface KnowledgeBrowserPanelProps {
  knowledge: KnowledgeBrowser;
}

export function KnowledgeBrowserPanel({ knowledge }: KnowledgeBrowserPanelProps) {
  const conceptNames = new Map(knowledge.concepts.map((concept) => [concept.key, concept.name]));

  return (
    <section className="knowledge-browser book-browser" aria-label="Brooks 知识浏览器">
      <div className="book-heading">
        <div>
          <BookOpen size={17} />
          <span>阿尔布鲁克斯价格行为学知识库</span>
        </div>
        <small>中文结构化教材 / 术语按 Brooks 官方 glossary 与 abbreviations 校对</small>
      </div>

      <div className="book-layout">
        <aside className="book-toc" aria-label="教材目录与概念图谱">
          <h2>教材目录</h2>
          <ol>
            {knowledge.chapterMap.map((chapter, index) => (
              <li key={`${chapter.sourceId}-${chapter.title}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{chapter.part} / {chapter.title}</strong>
                  <p>{chapter.summary}</p>
                  <em>
                    {chapter.conceptKeys.map((key) => conceptNames.get(key) ?? key).join(" / ")}
                  </em>
                </div>
              </li>
            ))}
          </ol>

          <h2>知识图谱</h2>
          <div className="concept-map" aria-label="概念关系">
            {knowledge.conceptEdges.map((edge) => (
              <span key={`${edge.source}-${edge.target}`}>
                {conceptNames.get(edge.source) ?? edge.source} → {conceptNames.get(edge.target) ?? edge.target}
                <em>{edge.relation}</em>
              </span>
            ))}
          </div>

          <h2>术语表</h2>
          <dl className="glossary-book" aria-label="术语表">
            {knowledge.glossary.map((term) => (
              <div key={term.english}>
                <dt>
                  {term.chinese}
                  <code>{term.abbreviation ? `${term.english} / ${term.abbreviation}` : term.english}</code>
                </dt>
                <dd>{term.definition}</dd>
              </div>
            ))}
          </dl>
        </aside>

        <article className="knowledge-book" aria-label="价格行为教材正文">
          <section className="book-chapter">
            <div className="book-chapter-kicker">
              <Route size={14} />
              第一部分：核心概念
            </div>
            <h2>从上下文到交易员方程</h2>
            <div className="concept-paragraphs">
              {knowledge.concepts.map((concept) => (
                <section key={concept.key}>
                  <h3>{concept.name}</h3>
                  <p>{concept.summary}</p>
                  <ul>
                    {concept.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>

          <section className="book-chapter">
            <div className="book-chapter-kicker">
              <FileText size={14} />
              第二部分：Al Brooks Setup 档案
            </div>
            <h2>形态不是标签，先看条件、测量和失效</h2>
            {knowledge.setupDossiers.map((dossier) => (
              <section className="setup-book-section" key={dossier.key}>
                <h3>{dossier.name}</h3>
                <p>{dossier.context}</p>
                <div className="setup-book-grid">
                  <ListBlock title="观察条件" items={dossier.observations} />
                  <ListBlock title="测量依据" items={dossier.measurements} />
                  <ListBlock title="入场方式" items={dossier.entryStyles} />
                  <ListBlock title="止损逻辑" items={dossier.stopLogic} />
                  <ListBlock title="目标" items={dossier.targets} />
                  <ListBlock title="失败模式" items={dossier.failureModes} />
                </div>
              </section>
            ))}
          </section>

          <section className="book-chapter">
            <div className="book-chapter-kicker">
              <ShieldQuestion size={14} />
              第三部分：Setup 示例图与推理手册
            </div>
            <h2>示例图只服务于可审计判断</h2>
            <div className="case-book-grid">
              {knowledge.caseCards.map((caseCard) => (
                <section key={caseCard.key} className="case-book-section">
                  <h3>{caseCard.title}</h3>
                  <CasePatternDiagram caseCard={caseCard} />
                  <p>{caseCard.chartContext}</p>
                  <p>{caseCard.patternInterpretation}</p>
                  <strong>{caseCard.expectedFollowThrough}</strong>
                  <span>{caseCard.failureScenario}</span>
                </section>
              ))}
            </div>

            <div className="playbook-book-list">
              {knowledge.reasoningPlaybooks.map((playbook) => (
                <section key={playbook.key}>
                  <h3>{playbook.name}</h3>
                  <ol>
                    {playbook.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ol>
                  <p>{playbook.displayGuardrails.join(" / ")}</p>
                </section>
              ))}
            </div>
          </section>

          <section className="source-book-map" aria-label="书籍来源映射">
            <h2>书籍来源映射</h2>
            {knowledge.sources.map((source) => (
              <p key={source.id}>
                <strong>{source.title}</strong>
                <span>{source.chapterRefs.join(" / ")}</span>
              </p>
            ))}
          </section>
        </article>
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
    <section className="setup-book-list">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
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

import MainLayout from '@/components/layout/MainLayout';
import s from './loading.module.css';

export default function HomeLoading() {
  return (
    <MainLayout fullWidth>
      {/* role="status" politely announces the wait; aria-busy tells assistive
          technology the region is still resolving, so a screen reader does not
          present the empty skeleton boxes as finished content. */}
      <div className={s.page} role="status" aria-busy="true" aria-label="Loading home page">
        {/* Hero skeleton */}
        <section className={s.hero}>
          <div className={s.heroInner}>
            <div className={s.heroCopy}>
              <div className={`${s.bone} ${s.eyebrow}`} />
              <div className={`${s.bone} ${s.headingLine}`} />
              <div className={`${s.bone} ${s.headingLine}`} />
              <div className={`${s.bone} ${s.subLine}`} />
              <div className={s.heroButtons}>
                <div className={`${s.bone} ${s.btnSkeleton}`} />
                <div className={s.btnRow}>
                  <div className={`${s.bone} ${s.btnRowItem}`} />
                  <div className={`${s.bone} ${s.btnRowItem}`} />
                  <div className={`${s.bone} ${s.btnRowItem}`} />
                </div>
              </div>
            </div>
            <div className={s.heroBudget}>
              <div className={s.widgetBox}>
                <div className={s.widgetHeader}>
                  <div className={`${s.bone} ${s.widgetLabel}`} />
                  <div className={`${s.bone} ${s.widgetBadge}`} />
                </div>
                <div className={`${s.bone} ${s.widgetTitle}`} />
                <div className={`${s.bone} ${s.widgetSubtitle}`} />
                <div className={`${s.bone} ${s.widgetInput}`} />
                <div className={`${s.bone} ${s.widgetChart}`} />
                <div className={`${s.bone} ${s.widgetVerdict}`} />
              </div>
            </div>
          </div>
        </section>

        {/* BOQ cards skeleton */}
        <section className={s.startSection}>
          <div className={s.sectionInner}>
            <div className={s.startHeader}>
              <div className={s.startHeaderLeft}>
                <div className={`${s.bone} ${s.sectionLabel}`} />
                <div className={`${s.bone} ${s.sectionTitle}`} />
              </div>
              <div className={`${s.bone} ${s.sectionDesc}`} />
            </div>
            <div className={s.startGrid}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={s.card}>
                  <div className={s.cardTopline}>
                    <div className={`${s.bone} ${s.cardRank}`} />
                    <div className={`${s.bone} ${s.cardCategory}`} />
                    {i === 0 && <div className={`${s.bone} ${s.cardBadge}`} />}
                  </div>
                  <div className={s.cardBody}>
                    <div className={`${s.bone} ${s.cardIcon}`} />
                    <div className={s.cardCopy}>
                      <div className={`${s.bone} ${s.cardTitle}`} />
                      <div className={`${s.bone} ${s.cardDesc1}`} />
                      <div className={`${s.bone} ${s.cardDesc2}`} />
                    </div>
                  </div>
                  <div className={s.cardFooter}>
                    <div className={`${s.bone} ${s.cardDetail}`} />
                    <div className={`${s.bone} ${s.cardAction}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Hint of next section */}
        <div className={s.pathwayHint}>
          <div className={s.sectionInner}>
            <div className={`${s.bone} ${s.pathwayHintLabel}`} />
            <div className={`${s.bone} ${s.pathwayHintTitle}`} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

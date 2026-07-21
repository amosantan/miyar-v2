export type BriefSectionView = {
  sectionId?: string;
  revisionId?: string | null;
  sectionKey?: string;
  title?: string;
  maturity?: string;
  maturityState?: string;
  achievedState?: string;
  content?: unknown;
  isStale?: boolean;
  isBlocked?: boolean;
  reasons?: BriefReasonView[];
};

export type BriefReasonView = {
  code: string;
  message?: string;
  nextAction?: string;
  sectionKey?: string;
  sectionId?: string;
  componentKey?: string;
  componentId?: string;
};

export type BriefReadinessView = {
  canIssue: boolean;
  displayProgress?: number;
  progress?: number;
  isStale?: boolean;
  isBlocked?: boolean;
  policyVersion?: string;
  reasons?: BriefReasonView[];
  deficits?: BriefReasonView[];
  sections: BriefSectionView[];
};

export type BriefStreamView = {
  id: number | string;
  briefId?: number | string;
  name?: string;
  purpose?: string;
  scope?: string;
  currentVersionId?: number | string;
  latestVersionId?: number | string;
};

export type BriefVersionView = {
  id: number | string;
  version?: number;
  versionNumber?: number;
  revision?: number;
  purpose?: string;
  assumptions?: unknown[];
  evidence?: unknown[];
  limitations?: unknown[];
  conditions?: unknown[];
  sections?: BriefSectionView[];
};

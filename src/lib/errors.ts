// Domain error hierarchy (addendum T5.1).
//
// All domain errors extend LcsError so callers can pattern-match on `instanceof
// LcsError` and on `.code`. Sentry groups by name + code, so a flood of one kind
// doesn't drown others.

export class LcsError extends Error {
  public override readonly name: string;
  public readonly code: string;

  public constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class FrontmatterError extends LcsError {
  public constructor(
    message: string,
    public readonly lessonPath: string,
  ) {
    super(message, 'FRONTMATTER_ERROR');
  }
}

export class TaxonomyError extends LcsError {
  public constructor(message: string) {
    super(message, 'TAXONOMY_ERROR');
  }
}

export class SearchIndexError extends LcsError {
  public constructor(
    message: string,
    public readonly query?: string,
  ) {
    super(message, 'SEARCH_INDEX_ERROR');
  }
}

export class NetworkTimeoutError extends LcsError {
  public constructor(
    message: string,
    public readonly url: string,
    public readonly timeoutMs: number,
  ) {
    super(message, 'NETWORK_TIMEOUT');
  }
}

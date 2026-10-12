import type { Span } from '../../trace';
import { AdGuardHome } from '../writing-strategy/adguardhome';
import type { BaseWriteStrategy } from '../writing-strategy/base';
import { ClashDomainSet } from '../writing-strategy/clash';
import { SingboxSource } from '../writing-strategy/singbox';
import { SurgeDomainSet } from '../writing-strategy/surge';
import { ShadowrocketRuleSet } from '../writing-strategy/shadowrocket';
import { FileOutput } from './base';

export class DomainsetOutput extends FileOutput {
  strategies: BaseWriteStrategy[] = [
    new SurgeDomainSet(),
    new ShadowrocketRuleSet('domainset'),
    new ClashDomainSet(),
    new SingboxSource('domainset')
  ];
}

export class AdGuardHomeOutput extends FileOutput {
  strategies: BaseWriteStrategy[];

  constructor(
    span: Span,
    id: string,
    outputDir: string
  ) {
    super(span, id);

    this.strategies = [
      new AdGuardHome(outputDir)
    ];
  }
}

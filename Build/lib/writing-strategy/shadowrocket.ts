import { OUTPUT_SHADOWROCKET_DIR } from '../../constants/dir';
import { SurgeRuleSet } from './surge';

/**
 * Shadowrocket consumes Surge-compatible RULE-SET entries. It does not consume
 * the raw DOMAIN-SET representation, so every RuleMesh bucket is serialized as
 * an explicit rule list while retaining the inherited FileOutput pipeline.
 */
export class ShadowrocketRuleSet extends SurgeRuleSet {
  public override readonly name = 'shadowrocket ruleset';

  constructor(
    type: 'domainset' | 'non_ip' | 'ip' | (string & {}),
    outputDir = OUTPUT_SHADOWROCKET_DIR
  ) {
    super(type, outputDir);
  }
}

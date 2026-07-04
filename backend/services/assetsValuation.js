// ==========================================================================
//  Valoracao de ativos: aplica cotacao automatica (bolsa/moeda/ouro) quando
//  ha ticker, senao usa o valor manual. Compartilhado entre a rota /assets
//  e o dashboard consolidado (/portfolio/summary).
// ==========================================================================
import { assetsRepo } from '../repositories/assets.js';
import { categoryInfo } from './assetCategories.js';
import { getAssetPriceBrl } from './quotes.js';

/** Enriquece um ativo com valor atual em BRL (cotacao ou manual). */
export async function enrichAsset(asset) {
  const info = categoryInfo(asset.category);
  let currentValue = asset.current_value;
  let priceBrl = null;
  let source = 'manual';

  if (info.quote !== 'manual' && asset.ticker && asset.quantity > 0) {
    const quote = await getAssetPriceBrl(info.quote, asset.ticker);
    if (quote) {
      priceBrl = quote.priceBrl;
      currentValue = quote.priceBrl * asset.quantity;
      source = quote.source;
    }
  }
  if (currentValue == null) currentValue = asset.invested; // sem cotacao nem manual

  const gainLoss = currentValue - asset.invested;
  return {
    ...asset,
    categoryLabel: info.label,
    categoryGroup: info.group,
    quoteType: info.quote,
    priceBrl,
    currentValueBrl: currentValue,
    gainLoss,
    gainLossPercent: asset.invested > 0 ? (gainLoss / asset.invested) * 100 : 0,
    source,
  };
}

/** Todos os ativos do usuario, valorados, com totais por grupo. */
export async function valuateUserAssets(userId) {
  const items = assetsRepo.listByUser(userId);
  const enriched = await Promise.all(items.map(enrichAsset));

  const byGroup = {};
  let totalInvested = 0;
  let currentValue = 0;
  for (const a of enriched) {
    totalInvested += a.invested;
    currentValue += a.currentValueBrl;
    byGroup[a.categoryGroup] = (byGroup[a.categoryGroup] || 0) + a.currentValueBrl;
  }

  return {
    items: enriched,
    summary: {
      totalInvested,
      currentValue,
      gainLoss: currentValue - totalInvested,
      gainLossPercent: totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0,
    },
    byGroup,
  };
}

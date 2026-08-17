export const REPERTOIRE_PRESETS={
  london:{
    id:'london',
    name:'London System',
    side:'white',
    anchors:[{when:{turn:'w',fullmove:1},uci:'d2d4'}]
  },
  caroKann:{
    id:'caroKann',
    name:'Caro-Kann',
    side:'black',
    anchors:[
      {when:{blackMoves:0,firstWhite:'e2e4'},uci:'c7c6'},
      {when:{blackMoves:0},uci:'d7d5'},
      {when:{blackMoves:1,played:'c7c6',notPlayed:'d7d5'},uci:'d7d5'},
      {when:{blackMoves:1,played:'d7d5',notPlayed:'c7c6',whiteNotPlayed:'e2e4'},uci:'c7c6'}
    ]
  }
};

export const DEFAULT_REPERTOIRE_SELECTION={white:'london',black:'caroKann'};

export function normalizeRepertoireSelection(selection={}){
  const normalized={...DEFAULT_REPERTOIRE_SELECTION};
  for(const side of ['white','black']){
    const presetId=selection?.[side];
    const preset=REPERTOIRE_PRESETS[presetId];
    if(preset?.side===side) normalized[side]=presetId;
  }
  return normalized;
}

export function availableRepertoires(side){
  return Object.values(REPERTOIRE_PRESETS).filter(preset=>preset.side===side);
}

// Legacy move-priority hints remain exported for existing training code. They are
// preset content, not product-wide constraints.
export const REPERTOIRE_MOVES={
  white:[
    ['g1','f3'],['c1','f4'],['e2','e3'],['c2','c3'],['b1','d2'],['f1','d3'],
    ['h2','h3'],['e1','g1'],['d1','e2'],['f3','e5'],['b2','b3'],['a2','a4'],
    ['f1','e1'],['a1','d1'],['e3','e4'],['c3','c4']
  ],
  black:[
    ['c8','f5'],['g8','f6'],['e7','e6'],['b8','d7'],['f8','e7'],['f8','d6'],
    ['e8','g8'],['d8','c7'],['h7','h6'],['a7','a6'],['b7','b5'],['f6','e4'],
    ['c6','c5'],['e6','e5'],['a8','c8'],['f8','e8']
  ]
};

const uci=m=>m?`${m.from}${m.to}`:null;

function matchesAnchor(when,ctx){
  if(when.turn && when.turn!==ctx.turn)return false;
  if(when.fullmove && when.fullmove!==ctx.fullmove)return false;
  if(Number.isInteger(when.blackMoves) && when.blackMoves!==ctx.blackMoves.length)return false;
  if(when.firstWhite && when.firstWhite!==uci(ctx.whiteMoves[0]))return false;
  if(when.played && !ctx.historyUci.has(when.played))return false;
  if(when.notPlayed && ctx.historyUci.has(when.notPlayed))return false;
  if(when.whiteNotPlayed && ctx.whiteUci.has(when.whiteNotPlayed))return false;
  return true;
}

export function repertoireAnchorForFen(chess,side,selection=DEFAULT_REPERTOIRE_SELECTION){
  try{
    const normalized=typeof selection==='string'?selection:normalizeRepertoireSelection(selection);
    const presetId=typeof normalized==='string'?normalized:normalized?.[side];
    const preset=REPERTOIRE_PRESETS[presetId];
    if(!preset || preset.side!==side)return null;
    const parts=chess.fen().split(' ');
    const history=chess.history({verbose:true})||[];
    const whiteMoves=history.filter(m=>m.color==='w');
    const blackMoves=history.filter(m=>m.color==='b');
    const ctx={
      turn:parts[1],
      fullmove:Number(parts[5]||1),
      whiteMoves,
      blackMoves,
      historyUci:new Set(history.map(uci)),
      whiteUci:new Set(whiteMoves.map(uci))
    };
    const rule=preset.anchors.find(x=>matchesAnchor(x.when||{},ctx));
    return rule?.uci||null;
  }catch{}
  return null;
}

export function isRequiredRepertoireMove(chess,side,uciMove,selection=DEFAULT_REPERTOIRE_SELECTION){
  return repertoireAnchorForFen(chess,side,selection)===uciMove;
}

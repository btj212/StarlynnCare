"""Parse MN MDH state-form correction orders into deficiency rows. Text as written; page headers removed."""
import re
LETTER_LEVEL={**{c:1 for c in 'ABC'},**{c:2 for c in 'DEF'},**{c:3 for c in 'GHI'},**{c:4 for c in 'JKL'}}
LETTER_SCOPE={**{c:'isolated' for c in 'ADGJ'},**{c:'pattern' for c in 'BEHK'},**{c:'widespread' for c in 'CFIL'}}
TAG=r'\{?\s?(\d\s?\d{3,4})\s?\}?'
HDR=re.compile(r"(?:LABORATORY DIRECTOR'S OR PROVIDER/SUPPLIER REPRESENTATIVE'S SIGNATURE TITLE \(X6\) DATE\s*)?STATE FORM 6899\s+\S+\s+If continuation sheet\s+\d+\s+of\s+\d+(?:\s*PRINTED:.*?TAG DEFICIENCY\)\s*(?:" + TAG + r"\s*Continued From page\s+\d+\s*" + TAG + r")?)?", re.S)
CONT=re.compile(TAG + r"\s*Continued From page\s+\d+\s*" + TAG)
START=re.compile(TAG + r"\s+((?:144G|144A|144D|245D|144\.|626\.|Minn|MN|4[0-9]{3})[^{}]{0,260}?)\s*" + TAG + r"\s*SS\s?=\s?([A-L])\b")
NOTMET=re.compile(r"This (?:MN|Minnesota) [Rr]equirement is not met as evidenced by:?", re.I)
TPC=re.compile(r"TIME PERIOD FOR CORRECTION:?\s*([^.]{0,40}?days?\)?\s*(?:days)?)", re.I)
TAIL=re.compile(r"(?:LABORATORY DIRECTOR'S OR PROVIDER/SUPPLIER REPRESENTATIVE'S SIGNATURE.*$)|(?:STATE FORM 6899\s+\S+\s+If continuation sheet\s+\d+\s+of\s+\d+\s*$)", re.S)
def norm(t): return re.sub(r'\s+',' ',t or '').strip()
HDR2=re.compile(r"PRINTED:\s*\d\d/\d\d/\d{4}\s*FORM APPROVED\s*STATEMENT OF DEFICIENCIES.{0,1200}?TAG\s*DEFICIENCY\)|PRINTED:\s*\d\d/\d\d/\d{4}\s*FORM APPROVED\s*STATEMENT OF DEFICIENCIES.{0,1200}?APPROPRIATE DATE\s*DEFICIENCY\)", re.S)
HDR3=re.compile(r"(?:LABORATORY DIRECTOR'S OR PROVIDER/SUPPLIER REPRESENTATIVE'S SIGNATURE TITLE \(X6\) DATE\s*)?STATE FORM 6899\s+\S+\s+If continuation sheet\s+\d+\s+of\s+\d+")
LETTER=re.compile(r"(P r o t e c t i n g|Electronically Delivered|An equal opportunity employer|Protecting, Maintaining and Improving the Health)")
def clean(t):
    t=norm(t); t=HDR.sub(' ',t); t=HDR2.sub(' ',t); t=HDR3.sub(' ',t); t=CONT.sub(' ',t); return norm(t)
def parse(text):
    del SKIPPED[:]
    t=clean(text)
    ms=[m for m in START.finditer(t) if norm(m.group(1)).replace(' ','')==norm(m.group(3)).replace(' ','')]
    out={}
    for k,m in enumerate(ms):
        tag=m.group(1).replace(' ',''); letter=m.group(4)
        end=ms[k+1].start() if k+1<len(ms) else len(t)
        blk=t[m.start():end]
        title_stat=norm(m.group(2))
        body=t[m.end():end]
        nm=NOTMET.search(body)
        desc=norm(title_stat+' '+(body[:nm.start()] if nm else ''))
        rest=body[nm.end():] if nm else ''
        tp=TPC.search(rest)
        narr=norm(rest[:tp.start()] if tp else rest)
        narr=norm(TAIL.sub('',narr))
        lm=LETTER.search(narr)
        if lm: narr=norm(narr[:lm.start()])
        braced=t[max(0,m.start()-1):m.start()+1].strip().startswith('{') or blk.lstrip().startswith('{')
        rec=dict(braced=braced,code=tag,category=title_stat.split(' ')[0] if title_stat else None,statute=title_stat,letter=letter,level=LETTER_LEVEL[letter],scope=LETTER_SCOPE[letter],
                 description=desc,inspector_narrative=narr or None,correction_period=norm(tp.group(1)) if tp else None,has_notmet=bool(nm))
        if tag not in out or (out[tag]['braced'] and not braced) or (out[tag]['braced']==braced and len(narr)>len(out[tag]['inspector_narrative'] or '')): out[tag]=rec
    # v5 (2026-11-27, Reviewer-approved): a tag counts with or without a printed 'SS=' letter.
    # Pass 2 adds tags pass 1 missed. Letter only if printed right after the repeated tag (margin letters allowed
    # in between); otherwise letter/level/scope stay None (never guessed). MN tag numbers start with 0.
    # Skipped (listed by caller via skipped_no_orders): blocks preceded by 'No correction orders are issued'.
    for m in NOSS.finditer(t):
        tag = m.group(1) + m.group(2)
        if tag in out or not tag.startswith('0'): continue
        pre = t[max(0, m.start() - 300):m.start()]
        if m.group(0).lstrip().startswith('{'):
            if ('braced:' + tag) not in SKIPPED: SKIPPED.append('braced:' + tag)
            continue
        if NO_ORDERS.search(pre):
            if tag not in SKIPPED: SKIPPED.append(tag)
            continue
        lm2 = LATE_SS.match(t, m.end())
        letter = lm2.group(1) if lm2 else None
        nxt = NEXT_TAG.search(t, m.end() + (lm2.end() - m.end() if lm2 else 0))
        end = min([x.start() for x in ms if x.start() > m.start()] + ([nxt.start()] if nxt else []) + [len(t)])
        title_stat = norm(m.group(3)); body = t[(lm2.end() if lm2 else m.end()):end]
        nm = NOTMET2.search(body)
        desc = norm(title_stat + ' ' + (body[:nm.start()] if nm else ''))
        rest = body[nm.end():] if nm else ''
        tp = TPC.search(rest)
        narr = norm(TAIL.sub('', norm(rest[:tp.start()] if tp else rest)))
        lm = LETTER.search(narr)
        if lm: narr = norm(narr[:lm.start()])
        out[tag] = dict(braced=False, code=tag, category=title_stat.split(' ')[0] if title_stat else None, statute=title_stat,
                        letter=letter, level=LETTER_LEVEL.get(letter), scope=LETTER_SCOPE.get(letter),
                        description=desc, inspector_narrative=narr or None, correction_period=norm(tp.group(1)) if tp else None,
                        has_notmet=bool(nm), pass2=True)
    # v5.1 (2026-11-27, Reviewer-approved): layout B, 'TAG TAG <title> TAG SS = L CFR(s): <statute> ... This LICENSURE
    # REQUIREMENT is NOT MET as evidenced by: ...' (statute AFTER the printed letter). Only tags still missing are added;
    # letter is the printed one. Page-break blocks ('Continued from page N') are cut out first.
    tb = PB.sub(' ', t)
    tb = norm(CONTB.sub(' ', tb))
    bms = list(BSTART.finditer(tb))
    for k, m in enumerate(bms):
        tag = m.group(1)
        if tag == '00000': continue
        if tag.startswith('00'): tag = '0' + tag[2:]   # layout B prints 00470 for tag 0470 (same tag number as 'x 470')
        if tag in out: continue
        end = bms[k + 1].start() if k + 1 < len(bms) else len(tb)
        title = norm(m.group(2)); letter = m.group(3)
        body = tb[m.end():end]
        nm = NOTMETB.search(body)
        stat = norm(body[:nm.start()] if nm else body)
        rest = body[nm.end():] if nm else ''
        tp = TPC.search(rest)
        narr = norm(TAIL.sub('', norm(rest[:tp.start()] if tp else rest)))
        lm = LETTER.search(narr)
        if lm: narr = norm(narr[:lm.start()])
        out[tag] = dict(braced=False, code=tag, category=stat.split(' ')[0] if stat else None, statute=stat,
                        letter=letter, level=LETTER_LEVEL[letter], scope=LETTER_SCOPE[letter],
                        description=norm(title + ' CFR(s): ' + stat), inspector_narrative=narr or None,
                        correction_period=norm(tp.group(1)) if tp else None, has_notmet=bool(nm), layoutB=True)
    return list(out.values())
PB = re.compile(r"(?:Office of Primary Care and Health Systems Management\s*)?(?:LABORATORY DIRECTOR'S OR PROVIDER/SUPPLIER REPRESENTATIVE'S SIGNATURE TITLE \(X6\) DATE\s*)?STATE FORM(?: 6899)?\s+Event ID:.{0,1500}?APPROPRIATE DEFICIENCY\)")
CONTB = re.compile(r"(0\d{3,4}) \1 Continued [Ff]rom page \d+ \1 SS ?= ?[A-L]\b")
BSTART = re.compile(r"(0\d{3,4}) \1 (?![Cc]ontinued)([A-Za-z][^{}]{1,150}?) \1 SS ?= ?([A-L])\b\s*CFR\(s\):\s*")
NOTMETB = re.compile(r"This (?:LICENSURE|MN|Minnesota) [Rr]equirement is not met as evidenc\s?E?ed(?:\s+[A-Z])?\s+by:?", re.I)
STAT2 = r"(?:144G|144A|144D|245D|144\.|626\.|Minn|MN|4[0-9]{3})"
NOSS = re.compile(r"\{?\s?(\d)\s?(\d{3,4})\s?\}?\s+(" + STAT2 + r"[^{}]{0,260}?)\s*\{?\s?\1\s?\2\s?\}?(?!\s*SS\s?=)")
LATE_SS = re.compile(r"\s*(?:\d{1,2}/\d{1,2}/\d{2,4}\s+)?(?:[A-Z]\s+){0,3}SS\s?=\s?([A-L])\b")
NEXT_TAG = re.compile(r"\{?\s?0\s?\d{3,4}\s?\}?\s+" + STAT2)
NO_ORDERS = re.compile(r"No correction orders? (?:are|is|were|was) issued", re.I)
NOTMET2 = re.compile(r"This (?:MN|Minnesota) [Rr]equirement is not met as evidenc\s?E?ed(?:\s+[A-Z])?\s+by:?", re.I)
SKIPPED = []
def assessed_total(text):
    t=norm(text)
    m=re.search(r'total amount you are\s*assesse\s?d\s*is\s*\$\s?([\d,]+(?:\.\d\d)?)',t,re.I)
    return (float(m.group(1).replace(',','')), t[max(0,m.start()-160):m.end()+20]) if m else (None,None)
def tag_codes(text):
    """D-row tags in first-seen order. One entry per tag."""
    seen=[]
    for rec in parse(text):
        code=rec.get('code')
        if code and code not in seen: seen.append(code)
    return seen

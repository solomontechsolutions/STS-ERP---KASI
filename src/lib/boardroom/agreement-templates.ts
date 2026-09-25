/**
 * Standard wording of the founder agreements every director and shareholder
 * signs in the Boardroom. Written for Solomon Tech Solutions Limited under
 * the laws of the United Republic of Tanzania, for review by the company's
 * advocate before reliance. Once reviewed, the Company Secretary publishes
 * any approved change as a new version from /boardroom/agreements.
 *
 * Plain-text layout conventions read by AgreementDocument when rendering:
 *   first line                     document title (centred, bold)
 *   a line in capitals             section heading, e.g. PARTIES
 *   "1.  HEADING IN CAPITALS"      numbered clause heading
 *   "1.1 text"                     numbered sub-clause (hanging indent)
 *   "(a) text", "(A) text"         lettered paragraph or recital
 *
 * House style: no em-dashes, no double spaces, no drafting notes.
 * Placeholders are filled from the Company record when a version is created.
 */
export type AgreementSeed = {
  code: string;
  title: string;
  summary: string;
  body: string;
};

const PARTIES = `THIS AGREEMENT takes effect on the date on which it is signed by the Founder, as recorded in the execution block below.

PARTIES

(1) {{company}}, a company incorporated in the United Republic of Tanzania with registration number {{companyNumber}}, whose registered office is at {{registeredOffice}} (the “Company”); and

(2) the individual whose name and signature appear in the execution block below, being a director or shareholder of the Company, or both (the “Founder”).`;

function general(n: number) {
  return `${n}. GENERAL

${n}.1 This Agreement may be signed electronically. The parties agree that an electronic signature applied through the Company’s KASI system, together with the record of the date, time and device of signature, is valid and binding in accordance with the Electronic Transactions Act, 2015 and has the same effect as a handwritten signature.

${n}.2 If any provision of this Agreement is held to be invalid or unenforceable, that provision shall apply with the minimum modification necessary to make it valid and enforceable, and the remaining provisions shall continue in full force and effect.

${n}.3 No failure or delay by the Company in exercising any right under this Agreement shall operate as a waiver of that right.

${n}.4 This Agreement may be varied only by a new version approved by the Board and signed by the Founder.

${n}.5 The obligations in this Agreement are in addition to, and do not limit, the Founder’s duties under the Companies Act, 2002 (Cap. 212), the Articles of Association of the Company and any shareholders’ agreement.

${n + 1}. GOVERNING LAW AND DISPUTES

${n + 1}.1 This Agreement is governed by and shall be construed in accordance with the laws of the United Republic of Tanzania.

${n + 1}.2 The parties shall first attempt in good faith to resolve any dispute arising out of or in connection with this Agreement by negotiation between the Founder and the Board within thirty (30) days of written notice of the dispute. A dispute not so resolved shall be submitted to the exclusive jurisdiction of the courts of the United Republic of Tanzania.

${n + 1}.3 Nothing in this clause prevents the Company from applying to a competent court at any time for an injunction or other urgent relief.`;
}

export const AGREEMENT_SEEDS: AgreementSeed[] = [
  {
    code: "loyalty",
    title: "Founder Loyalty and Fiduciary Undertaking",
    summary:
      "Confirms the Founder’s duty of loyalty and good faith to the Company, the handling of business opportunities, and collective responsibility for Board decisions.",
    body: `FOUNDER LOYALTY AND FIDUCIARY UNDERTAKING

${PARTIES}

RECITALS

(A) The Company was founded by its directors and shareholders to provide wireless internet and related technology services in the United Republic of Tanzania.

(B) The Founder holds a position of trust in relation to the Company, and the Company and its other founders rely on the Founder’s loyalty, good faith and commitment to the Company’s interests.

(C) The Founder gives the undertakings in this Agreement to record those obligations in writing.

IT IS AGREED as follows:

1. DEFINITIONS AND INTERPRETATION

1.1 In this Agreement:

(a) “Board” means the board of directors of the Company from time to time;

(b) “Business” means the provision of wireless internet (Wi-Fi) services, internet service provision, managed network services, software and the other activities registered for the Company from time to time;

(c) “Business Opportunity” means any contract, customer, site, licence, partnership, investment or other commercial opportunity within the scope of the Business;

(d) “Connected Person” means the Founder’s spouse, child, parent or sibling, and any company, partnership or other entity in which the Founder or any of those persons holds an interest or office.

1.2 Headings are for convenience only and do not affect interpretation. Words in the singular include the plural and the reverse.

2. DUTY OF LOYALTY

2.1 The Founder shall act honestly and in good faith in what the Founder considers to be the best interests of the Company as a whole, and shall not act for any collateral or improper purpose.

2.2 The Founder shall not use the Founder’s position, or any information, property or opportunity obtained through the Company, to obtain a benefit for the Founder or any Connected Person at the expense of the Company.

2.3 The Founder shall not accept any benefit from a third party that is conferred because of the Founder’s position in the Company, save with the prior approval of the Board.

3. BUSINESS OPPORTUNITIES

3.1 Every Business Opportunity that comes to the attention of the Founder by reason of the Founder’s association with the Company belongs to the Company.

3.2 The Founder shall promptly disclose each such Business Opportunity to the Board and shall not pursue it, directly or through a Connected Person, unless the Board has first declined it in writing.

4. CARE, DILIGENCE AND PARTICIPATION

4.1 Where the Founder is a director, the Founder shall exercise the care, diligence and skill that a reasonably prudent person would exercise in comparable circumstances.

4.2 The Founder shall use reasonable endeavours to attend meetings of the Board and of shareholders, shall read the papers circulated for those meetings, and shall participate in decisions of the Company in an informed and considered manner.

5. COLLECTIVE RESPONSIBILITY

5.1 The Founder shall respect and support decisions properly taken by the Board or by the shareholders, including decisions against which the Founder voted.

5.2 The Founder may record dissent in the minutes but shall not act to frustrate or undermine the implementation of a decision properly taken.

5.3 The Founder shall raise any disagreement concerning the Company through the Company’s governance procedures and not through public statements or statements to customers, suppliers, employees or regulators.

6. REPUTATION AND CONDUCT

6.1 The Founder shall conduct himself or herself in a manner that protects the reputation of the Company and its relationships with customers, suppliers, regulators, financiers and employees.

6.2 The Founder shall not make any statement that is false or misleading about the Company, its founders or its business.

7. DURATION

7.1 This Agreement applies for so long as the Founder is a director or shareholder of the Company.

7.2 Clauses 2.2, 3 and 6.2 continue to apply for a period of twelve (12) months after the Founder ceases to be both a director and a shareholder of the Company.

8. BREACH

8.1 A material breach of this Agreement shall be reported to the Board, which may take such action as is permitted by law and by the constitutional documents of the Company.

8.2 The Founder shall account to the Company for any benefit obtained in breach of this Agreement.

${general(9)}`,
  },
  {
    code: "nda",
    title: "Non-Disclosure Agreement",
    summary:
      "Protects the Company’s confidential information, including financial records, customer and subscriber data, network designs, software and business plans.",
    body: `NON-DISCLOSURE AGREEMENT

${PARTIES}

RECITALS

(A) In the course of the Founder’s association with the Company, the Founder has received and will continue to receive Confidential Information of the Company.

(B) The Company is willing to make Confidential Information available to the Founder only on the terms of this Agreement.

IT IS AGREED as follows:

1. DEFINITIONS AND INTERPRETATION

1.1 In this Agreement:

(a) “Confidential Information” means all information, in any form or medium, relating to the Company or its business that the Founder receives or learns by reason of the Founder’s association with the Company, including financial statements, management accounts, budgets, bank and payment gateway records, customer and subscriber data, pricing, contracts, supplier terms, network designs, site plans, software, source code, system credentials, business plans, board papers, minutes and resolutions;

(b) “Permitted Purpose” means the performance of the Founder’s role as a director or shareholder of the Company;

(c) “Personal Data” has the meaning given in the Personal Data Protection Act, 2022.

1.2 Information is not Confidential Information to the extent that the Founder can show that it (a) is or becomes generally available to the public other than through a breach of this Agreement, or (b) was lawfully in the Founder’s possession, free of any obligation of confidence, before it was received from the Company.

2. CONFIDENTIALITY OBLIGATIONS

2.1 The Founder shall keep all Confidential Information strictly confidential and shall use it only for the Permitted Purpose.

2.2 The Founder shall not disclose Confidential Information to any person except as permitted by clause 3.

2.3 The Founder shall protect Confidential Information with no less than reasonable care, and in any event with at least the care the Founder applies to the Founder’s own confidential information.

2.4 The Founder shall not copy, extract or remove Confidential Information from the Company’s systems except to the extent necessary for the Permitted Purpose.

3. PERMITTED DISCLOSURE

3.1 The Founder may disclose Confidential Information to the Company’s directors, officers, employees, auditors, advocates and professional advisers who need to know it for the Permitted Purpose and who are bound by duties of confidentiality no less protective than this Agreement.

3.2 The Founder may disclose Confidential Information to the extent required by law, by a court of competent jurisdiction or by a regulatory authority. Where lawful, the Founder shall give the Company prompt prior written notice of the requirement and shall disclose only the minimum information required.

4. PERSONAL DATA AND SYSTEM SECURITY

4.1 The Founder shall process Personal Data of the Company’s customers, subscribers and staff only in accordance with the Personal Data Protection Act, 2022 and the Company’s instructions.

4.2 The Founder shall keep all passwords and access credentials for the Company’s systems private, shall not share accounts, and shall notify the Company Secretary without delay of any actual or suspected unauthorised access.

5. RETURN OF INFORMATION

5.1 On the Company’s written request, and in any event when the Founder ceases to be both a director and a shareholder of the Company, the Founder shall return or securely destroy all Confidential Information in the Founder’s possession or control and shall confirm in writing that this has been done.

5.2 The Founder may retain Confidential Information only to the extent required by law, and clause 2 shall continue to apply to anything so retained.

6. NO LICENCE

6.1 All Confidential Information remains the property of the Company. Nothing in this Agreement grants the Founder any licence or other right in respect of the Confidential Information or any intellectual property of the Company.

7. DURATION

7.1 The obligations in this Agreement apply during the Founder’s association with the Company and for a period of five (5) years after the Founder ceases to be both a director and a shareholder of the Company.

7.2 Obligations relating to trade secrets, source code, system credentials and Personal Data continue for so long as the information concerned remains confidential.

8. REMEDIES

8.1 The Founder acknowledges that damages alone may not be an adequate remedy for a breach of this Agreement and that the Company shall be entitled to seek injunctive relief and specific performance in addition to any other remedy available to it.

${general(9)}`,
  },
  {
    code: "nca",
    title: "Non-Compete and Non-Solicitation Agreement",
    summary:
      "Restricts competition with the Company and the solicitation of its customers, employees and suppliers, during the Founder’s association and for twelve months after.",
    body: `NON-COMPETE AND NON-SOLICITATION AGREEMENT

${PARTIES}

RECITALS

(A) The Founder has access to the Confidential Information, customer relationships, supplier arrangements and strategy of the Company.

(B) The restrictions in this Agreement are intended to protect those legitimate business interests of the Company and go no further than is reasonably necessary for that purpose.

IT IS AGREED as follows:

1. DEFINITIONS AND INTERPRETATION

1.1 In this Agreement:

(a) “Restricted Business” means the provision of wireless internet (Wi-Fi) services, internet service provision, hotspot and campus network services, and managed network services, in each case of a kind provided or actively planned by the Company at the Termination Date;

(b) “Restricted Territory” means the United Republic of Tanzania;

(c) “Termination Date” means the date on which the Founder ceases to be both a director and a shareholder of the Company;

(d) “Restricted Period” means the period during which the Founder is a director or shareholder of the Company and the period of twelve (12) months after the Termination Date;

(e) “Restricted Customer” means any person, institution or subscriber group that was a customer of the Company, or with which the Company was in active negotiation, at any time during the twelve (12) months before the Termination Date, and with which the Founder had material dealings or about which the Founder received Confidential Information;

(f) “Key Person” means any employee or contractor of the Company engaged in a managerial, technical or sales capacity.

2. NON-COMPETITION

2.1 During the Restricted Period the Founder shall not, directly or indirectly, and whether as owner, shareholder, partner, director, employee, consultant, agent or otherwise, carry on or be engaged, concerned or interested in any Restricted Business within the Restricted Territory.

3. NON-SOLICITATION AND NON-DEALING

3.1 During the Restricted Period the Founder shall not, directly or indirectly:

(a) solicit or entice away from the Company, or accept business from, any Restricted Customer in respect of services that compete with those of the Company;

(b) solicit, entice away, employ or engage any Key Person, whether or not that person would breach a contract by leaving the Company;

(c) induce or attempt to induce any supplier, landlord, site owner or partner of the Company to cease or materially reduce its dealings with the Company, or to vary its terms to the detriment of the Company.

4. PERMITTED ACTIVITIES

4.1 Nothing in this Agreement prevents the Founder from holding, for investment purposes only, not more than five percent (5%) of any class of securities of a company listed on a recognised stock exchange.

4.2 The Board may consent in writing to any activity that would otherwise be restricted by this Agreement. Any such consent shall be recorded in the minutes of the Board and may be given subject to conditions.

5. REASONABLENESS

5.1 The Founder confirms that the Founder has had the opportunity to take independent legal advice on this Agreement and considers each restriction to be reasonable in its scope, territory and duration.

5.2 Each restriction in clauses 2 and 3 is a separate and independent obligation. If any restriction is held to be unenforceable but would be enforceable if part of it were deleted or its period or area reduced, it shall apply with such modification as is necessary to make it enforceable.

6. REMEDIES

6.1 The Founder acknowledges that a breach of this Agreement may cause the Company loss that damages alone would not adequately remedy, and that the Company shall be entitled to seek injunctive relief in addition to any other remedy available to it.

${general(7)}`,
  },
  {
    code: "secrecy",
    title: "Board Confidentiality and Secrecy Undertaking",
    summary:
      "Keeps the deliberations, votes, meeting recordings and records of the Board and shareholders secret.",
    body: `BOARD CONFIDENTIALITY AND SECRECY UNDERTAKING

${PARTIES}

RECITALS

(A) The effective governance of the Company depends on directors and shareholders being able to deliberate openly in the knowledge that their discussions, votes and records will remain confidential.

(B) The Company conducts Board and shareholder business, including meetings, decisions and votes, through its KASI system.

IT IS AGREED as follows:

1. DEFINITIONS

1.1 In this Agreement, “Board Proceedings” means all business of the Board and of the shareholders of the Company, including notices, agendas, papers, discussions, minutes, draft and final resolutions, individual votes and comments recorded in KASI, and any audio, video, chat or other content of meetings held through the Company’s online meeting facility.

2. SECRECY

2.1 The Founder shall keep all Board Proceedings secret and shall not disclose them to any person who is not a director, shareholder or authorised officer of the Company.

2.2 The Founder may communicate a decision of the Company only after the Board has resolved that it may be communicated, and then only in the form so approved.

2.3 The Founder shall not disclose how any other director or shareholder voted, or what any of them said, in the course of Board Proceedings, except within the Company’s own governance forums.

3. MEETINGS AND RECORDS

3.1 The Founder shall not record, photograph, screenshot, transcribe or forward any part of a meeting or any Boardroom content, except as authorised by the Board.

3.2 The Founder shall attend online meetings of the Company only from a private location where the proceedings cannot be seen or heard by any other person, and shall confirm the presence of any other person to the chair of the meeting.

3.3 The Founder shall access Board Proceedings only through the Company’s systems and shall not store copies on personal accounts or third-party services.

4. DEVICES AND ACCOUNTS

4.1 The Founder shall protect every device used to access KASI with a screen lock, shall keep the Founder’s password private, and shall sign out of any device that is shared with another person.

4.2 The Founder shall notify the Company Secretary without delay of any lost or stolen device, compromised account or suspected disclosure of Board Proceedings.

5. DURATION

5.1 This Agreement applies during the Founder’s association with the Company and continues without limit of time after the Founder ceases to be both a director and a shareholder of the Company.

${general(6)}`,
  },
  {
    code: "conflict",
    title: "Conflict of Interest Declaration and Undertaking",
    summary:
      "Declares existing interests and commits the Founder to disclose any personal interest in a Company matter and to abstain from the related decision.",
    body: `CONFLICT OF INTEREST DECLARATION AND UNDERTAKING

${PARTIES}

RECITALS

(A) The Company requires each of its founders to avoid situations in which their personal interests conflict, or may conflict, with the interests of the Company.

(B) This Agreement records the Founder’s declaration of interests and the procedure the Founder shall follow when a conflict arises.

IT IS AGREED as follows:

1. DEFINITIONS

1.1 In this Agreement:

(a) “Connected Person” means the Founder’s spouse, child, parent or sibling, and any company, partnership or other entity in which the Founder or any of those persons holds an interest or office;

(b) “Interest” means any direct or indirect financial or personal interest, including an interest held through a Connected Person.

2. DECLARATION

2.1 The Founder declares that, save as the Founder has disclosed in writing to the Board before signing this Agreement, neither the Founder nor any Connected Person has an Interest in any contract, transaction, supplier, customer or competitor of the Company.

3. DISCLOSURE

3.1 The Founder shall disclose to the Board the nature and extent of any Interest in an existing or proposed transaction or arrangement with the Company at the earliest opportunity and in any event before the matter is considered by the Board, in accordance with the Companies Act, 2002 (Cap. 212).

3.2 The Company Secretary shall record each disclosure in the minutes and in the register of interests kept by the Company.

4. ABSTENTION

4.1 Unless the Board resolves otherwise, the Founder shall not vote on, and shall withdraw from the discussion of, any matter in which the Founder has an Interest, and shall not be counted in the quorum for that matter.

4.2 No transaction in which the Founder has an Interest shall be entered into by the Company unless it has been approved by the Board, or where required by law or by the constitutional documents of the Company, by the shareholders.

5. GIFTS AND HOSPITALITY

5.1 The Founder shall not accept any gift, commission, hospitality or other benefit from a person dealing or seeking to deal with the Company where it could reasonably be regarded as likely to influence the Founder’s judgement.

5.2 The Founder shall declare to the Company Secretary any gift or hospitality received in connection with the Company with a value exceeding one hundred thousand Tanzanian shillings (TZS 100,000).

6. ANNUAL CONFIRMATION

6.1 The Founder shall confirm or update the Founder’s declaration of interests in writing at least once in each financial year of the Company and whenever the Founder’s interests change.

${general(7)}`,
  },
];

/**
 * Starting wording for the founder agreements every director and shareholder
 * signs in the Boardroom. These are version 1 drafts written for Solomon
 * Tech Solutions Limited under the laws of Tanzania. They MUST be reviewed
 * by the company's advocate before being relied on: once reviewed, the
 * Company Secretary publishes the approved wording as a new version from
 * /boardroom/agreements, and everyone is asked to sign that version.
 *
 * `{{company}}` is replaced with the registered legal name when a template
 * is first created.
 */
export type AgreementSeed = {
  code: string;
  title: string;
  summary: string;
  body: string;
};

export const AGREEMENT_SEEDS: AgreementSeed[] = [
  {
    code: "loyalty",
    title: "Founder Loyalty and Fiduciary Undertaking",
    summary:
      "Confirms loyalty to the company, the duty to act in good faith in its best interests, and the duties of a director and shareholder under the Companies Act.",
    body: `FOUNDER LOYALTY AND FIDUCIARY UNDERTAKING

1. Parties
This undertaking is given by the signatory, being a director and/or shareholder of {{company}} (the "Company"), in favour of the Company and its other founders.

2. Loyalty
2.1 I will act honestly and in good faith in what I consider to be the best interests of the Company as a whole, and not for any collateral purpose.
2.2 I will not use my position, or any information or opportunity that comes to me through the Company, to gain an advantage for myself or any other person at the expense of the Company.
2.3 Any business opportunity within the Company's registered business activities that comes to my attention because of my association with the Company belongs to the Company. I will first offer it to the Company through the Board.

3. Duties under the Companies Act
3.1 Where I am a director, I acknowledge the duties imposed on directors by the Companies Act, 2002 (Cap. 212) of Tanzania, including the duty to exercise the care, diligence and skill that a reasonably prudent person would exercise in comparable circumstances.
3.2 I will attend Board meetings, read Board papers, and take part in decisions of the Company in a considered and informed way.
3.3 I will respect and abide by decisions properly taken by the Board and by the shareholders, including those I voted against, while keeping my right to record my dissent in the minutes.

4. Unity of the founding team
4.1 I will not act to undermine the Company, its directors or its founders, publicly or privately, and will raise disagreements through the Company's own governance channels.
4.2 I will support the Company's reputation and its relationships with customers, suppliers, regulators and financiers.

5. Duration
This undertaking applies for as long as I am a director or shareholder of the Company. Clauses 2.2 and 2.3 continue for twelve (12) months after I cease to be either.

6. Governing law
This undertaking is governed by the laws of the United Republic of Tanzania.`,
  },
  {
    code: "nda",
    title: "Non-Disclosure Agreement",
    summary:
      "Protects the company's confidential information: finances, customers, technology, pricing, network designs and plans.",
    body: `NON-DISCLOSURE AGREEMENT

1. Parties
This agreement is made between {{company}} (the "Company") and the signatory (the "Recipient").

2. Confidential Information
"Confidential Information" means all information, in any form, that the Recipient receives or learns through the Company, including: financial statements, management accounts, bank and payment gateway records (including Selcom collections), customer and subscriber data, pricing, contracts, supplier terms, network designs, software, source code, credentials, business plans, board papers, minutes and resolutions. It excludes information that is or becomes public other than through a breach of this agreement, or that the Recipient can show was lawfully known to them before they received it from the Company.

3. Obligations
3.1 The Recipient will keep all Confidential Information strictly confidential and use it only for the Company's purposes.
3.2 The Recipient will not disclose Confidential Information to any person, except to the Company's directors, employees, auditors, advocates and advisers who need it for the Company's purposes and are bound by confidentiality duties, or where disclosure is required by law, a court or a regulator (in which case the Recipient will, where lawful, notify the Company first).
3.3 The Recipient will protect Confidential Information with at least the care they use for their own confidential information, and never less than reasonable care. This includes keeping KASI and other Company system passwords private and not sharing accounts.
3.4 Personal data of customers and staff will be handled in line with the Personal Data Protection Act, 2022 of Tanzania.

4. Return of information
On request, or when the Recipient ceases to be a director, shareholder or officer, the Recipient will return or destroy all Confidential Information in their possession and confirm this in writing.

5. Duration
These obligations continue during the Recipient's association with the Company and for five (5) years after it ends. Obligations regarding trade secrets, source code and personal data continue for as long as the information remains confidential.

6. Remedies
The Recipient accepts that a breach may cause the Company harm that damages alone cannot remedy, and that the Company may seek an injunction in addition to any other remedy.

7. Governing law
This agreement is governed by the laws of the United Republic of Tanzania.`,
  },
  {
    code: "nca",
    title: "Non-Compete and Non-Solicitation Agreement",
    summary:
      "Restricts competing with the company or poaching its customers, staff and suppliers during association and for a limited period after.",
    body: `NON-COMPETE AND NON-SOLICITATION AGREEMENT

1. Parties
This agreement is made between {{company}} (the "Company") and the signatory (the "Founder").

2. Purpose
The Founder has access to the Company's confidential information, customer relationships and strategy. This agreement protects those legitimate business interests and is limited to what is reasonable for that purpose.

3. Non-compete
During the Founder's association with the Company, and for twelve (12) months after it ends (the "Restricted Period"), the Founder will not, directly or indirectly, own, manage, operate, be employed by or provide services to any business that competes with the Company in the provision of wireless internet (Wi-Fi) services, internet service provision or related managed network services within the United Republic of Tanzania, without the prior written consent of the Board.

4. Non-solicitation
During the Restricted Period the Founder will not, directly or indirectly:
4.1 solicit or accept business from any customer, institution or subscriber group that was a customer of the Company during the last twelve (12) months of the Founder's association, for services that compete with the Company's;
4.2 solicit, employ or engage any employee or contractor of the Company; or
4.3 induce any supplier, landlord or partner to stop doing business with the Company or to reduce it.

5. Exceptions
Holding up to five percent (5%) of the listed shares of a public company is not a breach. The Board may grant written consent to specific activities, and the consent will be recorded in the minutes.

6. Reasonableness
The Founder accepts that the restrictions are reasonable in scope, area and duration. If any restriction is found unenforceable, it applies with the minimum modification needed to make it enforceable.

7. Governing law
This agreement is governed by the laws of the United Republic of Tanzania.`,
  },
  {
    code: "secrecy",
    title: "Board Confidentiality and Secrecy Undertaking",
    summary:
      "Keeps board deliberations, votes, meeting recordings and boardroom records secret.",
    body: `BOARD CONFIDENTIALITY AND SECRECY UNDERTAKING

1. Scope
This undertaking is given by the signatory to {{company}} (the "Company") and covers all Board and shareholder business, including: meeting discussions, agendas, papers, minutes, draft and final resolutions, individual votes and comments recorded in KASI, and any audio, video or chat from Company online meetings.

2. Undertakings
2.1 I will keep all deliberations of the Board and shareholders secret. I may disclose a decision once the Board has resolved that it may be communicated, and then only in the form approved.
2.2 I will not record, screenshot, forward or share any Company online meeting or Boardroom content outside the Company's own systems, except where the Board authorises it.
2.3 I will attend Company online meetings only from a private setting where others cannot see or hear the proceedings.
2.4 I will not discuss how any other director or shareholder voted or what they said, except inside Company governance forums.
2.5 I will report any suspected leak, lost device or compromised account to the Company Secretary immediately.

3. Devices and accounts
I will protect every device I use to access KASI with a screen lock, keep my password private, and sign out of shared devices.

4. Duration
This undertaking continues during my association with the Company and without time limit afterwards for the content described in clause 1.

5. Governing law
This undertaking is governed by the laws of the United Republic of Tanzania.`,
  },
  {
    code: "conflict",
    title: "Conflict of Interest Declaration",
    summary:
      "Commits to declaring any personal interest in a company transaction and stepping out of the related decision.",
    body: `CONFLICT OF INTEREST DECLARATION

1. Declaration
I, the signatory, confirm to {{company}} (the "Company") that, apart from interests I have already disclosed in writing to the Board, I have no direct or indirect interest in any contract, transaction, supplier, customer or competitor of the Company.

2. Continuing duty to disclose
2.1 I will disclose to the Board, at the earliest opportunity and before the matter is decided, the nature and extent of any interest I or any person connected with me (a spouse, child, parent, sibling, or a company or partnership I am involved in) has in any existing or proposed transaction with the Company, in line with the Companies Act, 2002 (Cap. 212).
2.2 Unless the Board resolves otherwise, I will not vote on, and will leave the discussion of, any matter in which I have such an interest. The Company Secretary will record the disclosure in the minutes.

3. Gifts and benefits
I will not accept any gift, commission or benefit from a person dealing with the Company that could reasonably be seen to influence my judgement, and will declare any gift above TZS 100,000 in value to the Company Secretary.

4. Governing law
This declaration is governed by the laws of the United Republic of Tanzania.`,
  },
];

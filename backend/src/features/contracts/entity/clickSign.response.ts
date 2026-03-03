// backend/src/contracts/dto/clicksign.response.ts

export class ClicksignSignerResponse {
  email: string;
  name: string;
  status: string; // ex: pending, signed, declined
  auths: string[];
}

export class ClicksignDocumentResponse {
  uuid: string;
  name: string;
  status: string; // ex: pending, running, closed
  file_url: string;
  signed_file_url: string | null;
  signers: ClicksignSignerResponse[];
}

export class ClicksignResponse {
  document: ClicksignDocumentResponse;
}

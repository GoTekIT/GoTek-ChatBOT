import {extractPdfText} from './pdf-extract';
import mammoth from 'mammoth';
import {HttpError} from './security';

const MAX_BYTES=2_000_000;
/** Extracts text from supported DOCX/PDF uploads. */
export async function extractDocumentText(filename:string,bytes:Buffer){
 if(bytes.length>MAX_BYTES)throw new HttpError(413,'DOCUMENT_TOO_LARGE');
 const ext=filename.toLowerCase().split('.').pop();
 if(ext==='pdf')return extractPdfText(filename,bytes);
 if(ext==='docx'){
  if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b)throw new HttpError(400,'INVALID_DOCUMENT');
  let result;
  try { result=await mammoth.extractRawText({buffer:bytes}); } catch { throw new HttpError(400,'INVALID_DOCUMENT'); }
  const text=result.value.replace(/\r\n?/g,'\n').trim();
  if(!text)throw new HttpError(400,'EMPTY_DOCUMENT');
  if(text.length>120000)throw new HttpError(413,'DOCUMENT_TEXT_TOO_LARGE');
  return {filename,content:text,warnings:result.messages.map(m=>m.message)};
 }
 throw new HttpError(415,'UNSUPPORTED_DOCUMENT_FORMAT');
}

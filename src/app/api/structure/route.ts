import { authorizeRequest, structureInput, compatibleProvider, apiError } from '@/lib/providers';
export const runtime='nodejs';
export async function POST(request:Request){try{authorizeRequest(request);const raw=await request.text();if(raw.length>9_000_000)return Response.json({error:'页面过大，请分批上传'},{status:413});const input=structureInput.parse(JSON.parse(raw));return Response.json(await compatibleProvider.structure(input),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}

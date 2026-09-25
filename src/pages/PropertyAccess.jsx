import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import PropertyAccessPanel from '../components/PropertyAccessPanel'
import PageLoading from '../components/ui/PageLoading'

export default function PropertyAccess() {
  const { id } = useParams(); const [property, setProperty] = useState(null); const [loading, setLoading] = useState(true)
  useEffect(() => { supabase.from('properties').select('id,title,agent_fee_amount,agent_fee_currency,status,public_latitude,public_longitude,landlord_id').eq('id',id).single().then(({data})=>{setProperty(data);setLoading(false)}) }, [id])
  if (loading) return <PageLoading label="Loading access request…" />
  if (!property) return <div className="max-w-lg mx-auto text-center text-gray-600">Listing not found.</div>
  return <div className="max-w-2xl mx-auto space-y-5"><Link to={`/properties/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600"><ArrowLeft size={15}/> Back to listing</Link><div className="rounded-2xl bg-white border border-gray-200 p-6"><h1 className="text-xl font-black text-primary">{property.title}</h1><PropertyAccessPanel property={property}/></div></div>
}

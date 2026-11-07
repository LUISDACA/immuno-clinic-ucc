"use client";
import { useRef } from 'react';
import { useMutation, useQueryClient, type UseMutationOptions, type MutateOptions, type QueryKey } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth/store';

// Only reads affected by this write are cancelled/refreshed. No clinical decisions.
export function useSafeMutation<T=unknown,E=Error,V=void,C=unknown>(
  options:UseMutationOptions<T,E,V,C> & { affectedQueries: QueryKey[] },
) {
  const busy=useRef(false);
  const owner=useRef<string|null>(null);
  const client=useQueryClient();
  const {affectedQueries,...base}=options;
  const cancel=()=>Promise.all(affectedQueries.map(queryKey=>client.cancelQueries({queryKey})));
  const refresh=()=>Promise.all(affectedQueries.map(queryKey=>client.invalidateQueries({queryKey})));
  const sameOwner=()=>owner.current===useAuthStore.getState().userId;
  const mutation=useMutation<T,E,V,C>({...base,
    mutationFn:async(v,context)=>{if(!sameOwner())throw new Error("La sesión cambió durante la operación");return await base.mutationFn!(v,context);},
    onMutate:async(v,context)=>{
      await cancel();
      if(!sameOwner())throw new Error("La sesión cambió durante la operación");
      return await base.onMutate?.(v,context) as C;
    },
    onSuccess:async(data,v,result,context)=>{
      if(!sameOwner())return;
      await cancel(); // Discard any polling read begun while the server was writing.
      if(!sameOwner())return;
      await refresh();
      if(sameOwner())await base.onSuccess?.(data,v,result,context);
    },
    onError:async(...args)=>{if(sameOwner()){await refresh();await base.onError?.(...args);}},
    onSettled:async(...args)=>{try{if(sameOwner())await base.onSettled?.(...args);}finally{busy.current=false;}},
  });
  return {...mutation,
    mutate:(v:V,callbacks?:MutateOptions<T,E,V,C>)=>{
      if(busy.current)return;busy.current=true;owner.current=useAuthStore.getState().userId;
      mutation.mutate(v,callbacks);
    },
    mutateAsync:async(v:V,callbacks?:MutateOptions<T,E,V,C>)=>{
      if(busy.current)throw new Error('Operación en curso');busy.current=true;owner.current=useAuthStore.getState().userId;
      try{return await mutation.mutateAsync(v,callbacks);}finally{busy.current=false;}
    },
  };
}

import { useCallback } from "react";

const MyFc = () => {

    
    const handleSimpleFcDispose = useCallback<(Parameters<typeof SimpleFc>[0]["onDispose"]) & Function>(() => {
        console.log('Dispose');
    }, []);
    return <SimpleFc onDispose={handleSimpleFcDispose} />
}


type ByAlias = { pop?: { count: number}, onDispose?: () => void }

interface ByInterface { pop?: { count: number, onDispose?: () => void} }

const SimpleFc: React.FC<{ pop?: { count: number, }, onDispose?: () => void }> = () => {
    return <div>123</div>
}
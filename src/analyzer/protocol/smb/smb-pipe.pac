%extern{
#include "zeek/analyzer/protocol/dce-rpc/DCE_RPC.h"
%}

refine connection SMB_Conn += {
	%member{
		map<uint32,bool> tree_is_pipe_map;
		map<uint64,zeek::analyzer::dce_rpc::DCE_RPC_Analyzer*> fid_to_analyzer_map;
	%}

	%cleanup{
		// Iterate all of the analyzers and destroy them.
		for ( const auto& kv : fid_to_analyzer_map )
			{
			if ( kv.second )
				{
				kv.second->Done();
				delete kv.second;
				}
			}
	%}

	function get_tree_is_pipe(tree_id: uint32): bool
		%{
		auto it = tree_is_pipe_map.find(tree_id);

		if ( it == tree_is_pipe_map.end() )
			return false;

		return it->second;
		%}

	function unset_tree_is_pipe(tree_id: uint32): bool
		%{
		tree_is_pipe_map.erase(tree_id);
		return true;
		%}

	function set_tree_is_pipe(tree_id: uint32): bool
		%{
		tree_is_pipe_map[tree_id] = true;
		return true;
		%}

	function forward_dce_rpc(pipe_data: bytestring, fid: uint64, is_orig: bool): bool
		%{
		zeek::analyzer::dce_rpc::DCE_RPC_Analyzer *pipe_dcerpc = nullptr;
		auto it = fid_to_analyzer_map.find(fid);

		if ( it == fid_to_analyzer_map.end() )
			{
			// Too many analyzers?
			if ( zeek::BifConst::SMB::max_dce_rpc_analyzers > 0 &&
			     fid_to_analyzer_map.size() >= zeek::BifConst::SMB::max_dce_rpc_analyzers )
				{
				if ( smb_discarded_dce_rpc_analyzers )
					zeek::BifEvent::enqueue_smb_discarded_dce_rpc_analyzers(zeek_analyzer(), zeek_analyzer()->Conn());

				for ( const auto& kv : fid_to_analyzer_map )
					{
					kv.second->Done();
					delete kv.second;
					}

				fid_to_analyzer_map.clear();
				}

			auto tmp_analyzer = zeek::analyzer_mgr->InstantiateAnalyzer("DCE_RPC", zeek_analyzer()->Conn());
			pipe_dcerpc = static_cast<zeek::analyzer::dce_rpc::DCE_RPC_Analyzer *>(tmp_analyzer);

			if ( pipe_dcerpc )
				{
				pipe_dcerpc->SetFileID(fid);
				fid_to_analyzer_map[fid] = pipe_dcerpc;
				}
			}
		else
			{
			pipe_dcerpc = it->second;
			}

		if ( pipe_dcerpc )
			pipe_dcerpc->DeliverStream(${pipe_data}.length(), ${pipe_data}.begin(), is_orig);

		return true;
		%}

	function forward_dce_rpc_close(fid: uint64): bool
		%{
		auto it = fid_to_analyzer_map.find(fid);

		if ( it != fid_to_analyzer_map.end() )
			{
			it->second->Done();
			delete it->second;
			fid_to_analyzer_map.erase(it);
			return true;
			}

		return false;
		%}
};

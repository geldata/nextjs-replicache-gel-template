module default {
  global current_group_id: str;
  global current_group := (
    select ReplicacheClientGroup
    filter .client_group_id = global current_group_id
  );

  abstract type WithTimestamps {
    required created_at: datetime {
      default := datetime_of_transaction();
      readonly := true;
    };
    updated_at: datetime {
      rewrite insert, update using (datetime_of_statement());
    };
  }
  
  type ReplicacheClientGroup extending WithTimestamps {
    required client_group_id: str {
      constraint exclusive;
    };

    # ------------------
    # CLIENT VIEW RECORD - https://doc.replicache.dev/strategies/row-version#client-view-records
    required client_view_record: json {
      annotation description := 'Captures what data the Client Group has access to, as of last pull';

      # { [replicache_id (str)]: replicache_version (int64) }
      default := to_json('{}');
    };

    # Replicache requires that cookies are ordered within a client group.
    # To establish this order we simply keep a counter.
    required cvr_version: int64 {
      default := 0;
    };
    # ------------------

    # @TODO: figure out access policy limiting inserting new clients
    # ERROR: ⨯ CardinalityViolationError: required link 'client_group' of object type 'default::ReplicacheClient' is hidden by access policy
    
    # access policy allow_insert allow insert;
    # access policy allow_select_update allow select, update using (
    #   global current_group_id ?= .client_group_id
    # );

    index on ((.client_group_id));
  }

  type ReplicacheClient extending WithTimestamps {
    required client_id: str {
      constraint exclusive;
    };
    required client_group: ReplicacheClientGroup {
      on target delete delete source;
    };
    required last_mutation_id: int32;

    access policy allow_insert allow insert;
    
    access policy allow_select_update allow select, update using (
      global current_group ?= .client_group
    );
  }

  abstract type ReplicacheObject extending WithTimestamps {
    required replicache_id: str {
      constraint exclusive;

      annotation description := 'The key/id of the object in the Replicache client, generated in the front-end with nanoid via the `generate_replicache_id` function.';
    };
    required replicache_version: int64 {
      default := 1;
      rewrite update using (.replicache_version + 1);
    };

    index on ((.replicache_id));
  }

  type Todo extending ReplicacheObject {
    required content: str;
    required complete: bool;
    required client_group: ReplicacheClientGroup;

    access policy allow_insert allow insert;
    
    access policy allow_select_update allow select, update, delete using (
      global current_group ?= .client_group
    );
  }
}
 
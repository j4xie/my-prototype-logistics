if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/jietaoxie/.gradle/caches/8.13/transforms/6fb658ce51339aaaeea6f62b0e107225/transformed/hermes-android-0.79.6-debug/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/jietaoxie/.gradle/caches/8.13/transforms/6fb658ce51339aaaeea6f62b0e107225/transformed/hermes-android-0.79.6-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

